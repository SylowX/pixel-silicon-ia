# `alu8` Microarchitecture Specification

## 1. Block Overview

- **Block name:** `alu8`
- **Function:** `alu8` is a stateless 8-bit arithmetic/logic unit. It accepts two unsigned 8-bit operands and a 3-bit operation selector and continuously produces one 8-bit result. The supported operations are modulo-256 addition, modulo-256 subtraction, bitwise AND, bitwise OR, and bitwise XOR. Unsupported selector encodings produce `8'h00`.
- **Source basis:** No ERS file, FRD file, frozen interface contract, architecture/block diagram, or Python golden model was supplied or present in the workspace. The minimal port contract and opcode map in this document are therefore derived from the block description and become the implementation contract for this standalone block. No software golden model constrains the implementation.
- **Latency:** 0 clock cycles; the output is combinational in the current input values.
- **Throughput:** 1 operation per cycle when placed in the specified 50 MHz synchronous system, or 50 million operations/second, provided the driving inputs satisfy the receiving register's setup/hold requirements.
- **Pipeline depth:** 0 registered stages; one combinational logic stage.
- **Interface protocol:** Simple dedicated pins, with no valid/ready handshake and no backpressure. The block-specific requirement permits a combinational implementation when no state is needed. Consequently, `alu8` has no clock or reset port and contains no sequential state.
- **Technology target:** SkyWater Sky130, `sky130_fd_sc_hd`, nominal target clock context 50 MHz (20 ns period), synthesizable Verilog-2005/Yosys.

## 2. Interface Specification

| Port | Direction | Width | Protocol | Description |
|---|---:|---:|---|---|
| `a` | Input | 8 bits | Dedicated pins | Operand A, unsigned integer in the range 0 through 255. It is part of the same combinational transaction as `b` and `op`. |
| `b` | Input | 8 bits | Dedicated pins | Operand B, unsigned integer in the range 0 through 255. It is part of the same combinational transaction as `a` and `op`. |
| `op` | Input | 3 bits | Dedicated pins | Operation encoding: `000` ADD, `001` SUB, `010` AND, `011` OR, `100` XOR, and `101` through `111` reserved/invalid. |
| `result` | Output | 8 bits | Dedicated pins | Combinational result for the current `a`, `b`, and `op`. Reserved `op` values produce `8'h00`. |

There are deliberately no `clk`, `rst_n`, valid, ready, flag, carry, borrow, or overflow ports. The block is stateless, the supplied requirements only conditionally require `rst_n` for stateful logic, and no supplied interface contract defines such ports. `a`, `b`, and `op` must be treated atomically by the driving logic: they must all describe the same operation and remain stable for the complete setup/hold aperture of any downstream capture register.

Opcode encoding:

| `op` | Mnemonic | Exact result definition |
|---:|---|---|
| `3'b000` | ADD | `(a + b) mod 256` |
| `3'b001` | SUB | `(a - b) mod 256` |
| `3'b010` | AND | `a & b` |
| `3'b011` | OR | `a \| b` |
| `3'b100` | XOR | `a ^ b` |
| `3'b101`-`3'b111` | RESERVED | `8'h00` |

## 3. Microarchitecture

### 3.1 Top-Level Block Diagram

```text
                           +----------------------+
 a[7:0] ----------------->| zero/sign extension  |----+
                           +----------------------+    |
                                                       v
                           +----------------------+  +------------------+
 b[7:0] ----------------->| zero/sign extension  |->| 9-bit ADD / SUB  |--- add/sub[7:0] --+
                           +----------------------+  +------------------+                    |
                                                                                             |
 a[7:0] ----+-----------------------> bitwise AND -------------------------- and[7:0] -------+|
            +-----------------------> bitwise OR --------------------------- or[7:0] --------||
            +-----------------------> bitwise XOR -------------------------- xor[7:0] -------||| 
 b[7:0] ----+                                                                                |||
                                                                                             vvv
 op[2:0] -------------------------------------------------------------> +-------------------------+
                                                                         | opcode decode + 5:1 mux |---> result[7:0]
                                                                         | default = 8'h00         |
                                                                         +-------------------------+
```

All blocks in the diagram are combinational. There is no feedback, pipeline register, storage, clock gating, or reset logic.

### 3.2 Datapath

All numeric values are plain binary integers; fixed-point Q notation is not applicable.

**Bit-width derivation**

1. `a` and `b` are unsigned 8-bit values, each with range `[0, 255]`.
2. Addition has mathematical range `[0, 510]`, which requires 9 unsigned bits. Form `a_u9 = {1'b0, a}` and `b_u9 = {1'b0, b}`, then compute `add9[8:0] = a_u9 + b_u9`. `result = add9[7:0]`; discarding `add9[8]` is explicit modulo-256 wraparound. There is no saturation and no exposed carry flag.
3. Subtraction has mathematical range `[-255, +255]`, which fits a 9-bit two's-complement signed value (`[-256, +255]`). Compute `diff9` as a signed 9-bit subtraction of the zero-extended operands: `diff9 = $signed({1'b0,a}) - $signed({1'b0,b})`. `result = diff9[7:0]`; discarding bit 8 implements modulo-256 two's-complement wraparound. There is no saturation and no exposed borrow or signed-overflow flag.
4. AND, OR, and XOR are eight independent one-bit Boolean operations and produce unsigned 8-bit values without growth or truncation.
5. A combinational opcode decoder selects one of the five 8-bit candidates. A default assignment of `8'h00` before the `case (op)` plus explicit legal cases guarantees full assignment and prevents latch inference. `casez`/`casex` must not be used, so simulation X/Z values cannot accidentally match a valid opcode.

An implementation may share addition and subtraction as one 9-bit adder by conditionally XORing each bit of `b` with `sub_sel = (op == 3'b001)` and using `sub_sel` as carry-in. If shared, the exact arithmetic is `{1'b0,a} + {1'b0,(b ^ {8{sub_sel}})} + sub_sel`, with only the low eight result bits selected. This is equivalent to the definitions above for all binary inputs. The implementation must not reduce either arithmetic path to 8 bits before the operation completes.

### 3.3 Control Logic

No FSM is needed. `alu8` is always active and has no transaction state.

Control is a full combinational decode of `op[2:0]`:

- `000`: route `add9[7:0]` to `result`.
- `001`: route `diff9[7:0]` (or the shared add/sub equivalent) to `result`.
- `010`: route `a & b` to `result`.
- `011`: route `a | b` to `result`.
- `100`: route `a ^ b` to `result`.
- `101`, `110`, `111`, or an incompletely known simulation value: route the default `8'h00`.

There is no handshake, command pulse, START/DONE behavior, bridge state, or backpressure. Because no decoded value survives beyond the current combinational evaluation, there is no latched-control-decision requirement. A single `always @*` block with a default followed by a plain `case`, or equivalent continuous assignments, is required; incomplete sensitivity lists and inferred latches are forbidden.

### 3.4 Storage Elements

The block contains no registers, arrays, FIFOs, SRAMs, ROMs, LUT memories, scratchpads, or other storage elements. The opcode decoder is combinational logic, not a stored lookup table. Consequently, there are no memory-manifest entries.

- `flip_flop_budget = 0 FF` (bit-level count). Synthesis is expected to report no sequential cells.
- `sram_budget = 0 bits (0 KiB), 0 macros`.
- No OpenRAM macro generation is required.

The design is therefore within any nonnegative per-block flop/SRAM allocation. If synthesis reports a latch or flip-flop, the RTL violates this specification.

## 4. Algorithm Mapping

No Python golden model exists. The following mapping is directly from the functional description:

| Functional operation | Hardware equivalent | Precision/overflow rule |
|---|---|---|
| 8-bit addition | One 9-bit unsigned adder after zero extension | Keep bits `[7:0]`; modulo-256 wraparound |
| 8-bit subtraction | One 9-bit signed subtractor, or the same 9-bit adder with conditional B inversion and carry-in 1 | Keep bits `[7:0]`; modulo-256 two's-complement wraparound |
| AND | Eight parallel 2-input AND functions | Exact, no overflow |
| OR | Eight parallel 2-input OR functions | Exact, no overflow |
| XOR | Eight parallel 2-input XOR functions | Exact, no overflow |
| Operation selection | 3-to-5 decode followed by an 8-bit result mux | Invalid encodings return zero |

There are no loops, dynamic lists, dictionaries, floating-point operations, casts, exceptions, or model-specific rounding operations to map. Golden equivalence is replaced by exact conformance to the opcode equations in Section 2. Validation tolerance is exact bit equality for all `256 x 256 x 8 = 524,288` binary input combinations.

### 4a. Cross-Block Semantic Invariants (MANDATORY)

No connection graph or neighboring blocks were supplied, so no named stateful feedback loop, reconstruction context, packet metadata, or downstream block can be identified. This is safe because `alu8` is stateless and its entire semantic transaction is present simultaneously on dedicated pins. The following invariants still bind any producer and consumer connected later.

**Invariant ID: `INV-ALU-ATOMIC-001`**

- **Applies to ports/state:** `a[7:0]`, `b[7:0]`, `op[2:0]`, and `result[7:0]`; there is no internal state.
- **Golden reference point:** No golden model exists. Reference point is the opcode/equation table in Section 2.
- **Tolerance:** Exact bit equality.
- **Update/consume timing:** `result` changes combinationally after any input changes. A consumer captures `result` only after `a`, `b`, and `op` have all been stable for the full combinational delay plus its setup time.
- **Downstream dependency:** Any connected result consumer depends on all three inputs belonging to the same logical operation. Mixing an opcode from one operation with operands from another yields a valid-looking but semantically wrong result.
- **Validation hook:** Dump top-level `a`, `b`, `op`, and `result`; at every capture edge, compare `result` with the equation selected by the simultaneously sampled inputs.

**Invariant ID: `INV-ALU-MOD256-002`**

- **Applies to ports/state:** `a`, `b`, `op`, `result`, and internal `add9`/`diff9` if exposed in a debug VCD.
- **Golden reference point:** No golden model exists. Reference is `(a+b) & 8'hff` for `op=000` and `(a-b) & 8'hff` for `op=001`.
- **Tolerance:** Exact equality; no saturation tolerance and no signed reinterpretation.
- **Update/consume timing:** Continuous combinational evaluation in the same cycle as the input values.
- **Downstream dependency:** A consumer performing byte arithmetic relies on wraparound. Saturation or accidental carry insertion would change the byte value at overflow/underflow boundaries.
- **Validation hook:** Check `8'hff + 8'h01 -> 8'h00`, `8'h00 - 8'h01 -> 8'hff`, and exhaustively compare all operand pairs for both arithmetic opcodes.

**Invariant ID: `INV-ALU-OPMAP-003`**

- **Applies to ports/state:** `op` and `result`.
- **Golden reference point:** The fixed opcode table in Section 2; there is no software function.
- **Tolerance:** Exact equality.
- **Update/consume timing:** Decode and result selection occur in the same combinational evaluation.
- **Downstream dependency:** Any operation issuer relies on this exact encoding. Reordering AND/OR/XOR silently executes the wrong operation.
- **Validation hook:** Sweep all eight opcodes with asymmetric operands such as `a=8'h96`, `b=8'h3c`; confirm reserved codes return zero.

There is no stateful feedback loop. No mode, metadata, packet ordering, or adaptive state is dropped because none exists in the supplied block description.

## 5. Reset and Initialization

`alu8` has no sequential elements, so it has no reset input, reset polarity, reset state, or initialization sequence. The system-level synchronous active-low reset requirement applies only when stateful logic is present.

During system reset, `result` remains the combinational function of `a`, `b`, and `op`; it is not forced to zero unless `op` is reserved or the system drives inputs that compute zero. Downstream stateful logic is responsible for ignoring or not capturing the result while that logic is in reset. There are no completion/event flags, so reset-idle cannot be confused with completion.

## 6. Timing and Performance

- **Clock context:** 50 MHz, corresponding to a 20 ns external cycle. `clk` is not a block port.
- **Critical path:** In a shared add/sub implementation, the longest path is `op` decode -> conditional inversion/control mux on B -> 9-bit carry-propagate adder -> 8-bit operation-select mux -> `result`. In a precomputed implementation, the longest path is a 9-bit adder/subtractor followed by the operation-select mux.
- **Timing expectation:** A 9-bit integer adder plus a shallow 5-way 8-bit mux is expected to close comfortably within 20 ns in `sky130_fd_sc_hd`. Static timing analysis after synthesis is authoritative; constrain input-to-output delay consistently with the enclosing 50 MHz register-to-register budget.
- **Pipeline boundaries:** None. The complete function lies between the upstream and downstream registers outside this module.
- **Throughput:** Inputs may change once per system cycle and one independent result may be captured every cycle. There are no bubbles or warm-up cycles.
- **Backpressure:** Not applicable. The dedicated-pin interface has no valid/ready signals and cannot stall.

### 6.1 Throughput Budget (MANDATORY)

No FRD was supplied. To make the requirement checkable, this specification defines local requirement **`PERF-001`**: at 50 MHz the ALU must accept a new operand/opcode tuple every cycle, with a cap of 1 cycle per operation. This is a locally derived requirement, not a citation to a missing FRD.

- **Initiation Interval:** `II = 1`. There is no loop-carried recurrence or shared sequential resource.
- **Iterations:** `1` combinational ALU evaluation per operation.
- **Scheduling pipeline depth:** `1` combinational scheduling stage, corresponding to `0` registered pipeline stages and latency 0.
- **Drain:** `0` cycles.
- **I/O framing:** `0` cycles.
- **Computed cycles/op:** `iterations x II + (pipeline_depth - 1) + drain + io_framing = 1 x 1 + (1 - 1) + 0 + 0 = 1 cycle/op`.
- **Requirement comparison:** `1 cycle/op <= PERF-001 cap of 1 cycle/op`: **MEETS**.
- **Binding constraint:** The 20 ns combinational input-to-output timing path, principally the 9-bit add/sub path plus result mux. There is no RecMII or ResMII greater than 1. If post-synthesis timing unexpectedly fails, the appropriate lever is Boolean/mux restructuring or a registered wrapper at system level; adding internal serialization would violate `PERF-001` and change the frozen latency/interface behavior.

```perf
{ "op_unit": "block", "target_clock_mhz": 50, "iterations": 1,
  "pipeline_chain": [["mux", 9], ["add", 9], ["mux", 8]],
  "resources": [{"name": "addsub", "op": "add", "width": 9, "instances": 1,
                 "uses_per_iter": 1}],
  "rec_cycles": [],
  "drain_cyc": 0, "io_framing_cyc": 0,
  "perf_req_id": "PERF-001", "perf_req_cyc_per_op": 1,
  "declared_cyc_per_op": 1 }
```

### 6a. Output Timing Contract (MANDATORY)

| Output port | Type | Pipeline latency | First valid cycle after reset | Timing rule |
|---|---|---:|---:|---|
| `result[7:0]` | Combinational | 0 cycles | 0 cycles | Continuously valid for the current stable `a`, `b`, and `op` after combinational propagation. There is no block reset; the value can be captured on the first system edge after system reset deassertion if inputs meet setup/hold. |

`result` has no separate valid qualifier. “Valid” means that the three inputs are binary, mutually aligned, and have remained stable long enough for the combinational path to settle.

```wavedrom
{signal: [
  {name: 'clk (context)', wave: 'p.....'},
  {name: 'a',             wave: 'x=.=..', data: ['A0','A1']},
  {name: 'b',             wave: 'x=.=..', data: ['B0','B1']},
  {name: 'op',            wave: 'x=.=..', data: ['OP0','OP1']},
  {name: 'result',        wave: 'x=.=..', data: ['f(A0,B0,OP0)','f(A1,B1,OP1)']}
],
 head: {text: 'result is combinational; pipeline latency = 0 cycles'}}
```

The WaveDrom `clk` is integration context only and is not an `alu8` port. The aligned transitions express zero-cycle behavior; real gate propagation delay and downstream setup time still apply.

## 7. Edge Cases and Corner Conditions

- **Addition overflow:** Wrap modulo 256. Example: `8'hff + 8'h01 = 8'h00`. No carry flag is exposed.
- **Subtraction underflow:** Wrap modulo 256 in two's complement. Example: `8'h00 - 8'h01 = 8'hff`. No borrow flag is exposed.
- **Signed interpretation:** Inputs and outputs are unsigned byte values. Subtraction uses a signed 9-bit intermediate only to preserve the mathematical range; this does not make the interface signed.
- **Logical operations:** Operate independently on all eight bit positions.
- **Reserved opcode:** `op=101`, `110`, or `111` produces `8'h00`, independent of operands.
- **Unknown simulation inputs:** A plain `case` with a preassigned zero default causes any X/Z-containing `op` that does not exactly match a valid opcode to produce zero. X/Z bits in `a` or `b` may propagate for a valid opcode, as ordinary four-state Verilog semantics dictate. Hardware operation is defined only for binary pin values.
- **First sample after reset:** There is no local reset or warm-up. With stable binary inputs, the output is usable immediately after combinational settling and may be captured on the first post-reset system edge.
- **Idle/empty/completion:** Not applicable; the block is always active and has no status flags.
- **Rapid input changes/glitches:** Intermediate output glitches are permitted while inputs or `op` transition. A downstream register must sample only after the inputs and result satisfy timing. No asynchronous side effect is driven by `result` inside this block.

## 8. Implementation Notes

- Use Verilog-2005 constructs only. Recommended coding is `always @*` with `result_r = 8'h00;` followed by a plain `case (op)`, then `assign result = result_r;`, or equivalent continuous combinational logic.
- Do not use `always_comb`, SystemVerilog enums/logic types, asynchronous reset constructs, latches, tri-states, delays, `initial`, `force`, or non-synthesizable assertions in the implementation.
- Make arithmetic widths explicit. Unsized literals and context-dependent 8-bit arithmetic are discouraged because they obscure the required 9-bit intermediates.
- Do not infer a ROM for opcode decoding and do not add pipeline registers merely to ease timing; both would violate the declared storage or latency contract.
- Yosys synthesis should report zero flip-flops/latches and no memories. Review the mapped netlist for only combinational `sky130_fd_sc_hd` cells.
- Directed verification should include zero, one, `8'h7f`, `8'h80`, `8'hfe`, and `8'hff`; addition carry; subtraction underflow; identical operands; complementary bit patterns; and all reserved opcodes.
- Exhaustive simulation is practical: 524,288 input combinations. Compare against the Section 2 equations, not against an invented Python model.
- Contract-audit VCD signals: mandatory `a`, `b`, `op`, and `result`; optional internal `add9[8:0]`, `diff9[8:0]`, and logic candidates. These prove atomic selection, modulo behavior, and opcode mapping.
- Arithmetic review checklist: input/output ranges are documented; intermediate widths are derived; no Q-format is used; truncation is explicitly modulo wraparound; no saturation is implied; edge tests cover overflow and underflow.

## 9. Verilog Interface Stub

```verilog
module alu8 (
    input  wire [7:0] a,
    input  wire [7:0] b,
    input  wire [2:0] op,
    output wire [7:0] result
);
endmodule
```

```json
{
  "block_name": "alu8",
  "latency_cycles": 0,
  "throughput_samples_per_cycle": 1.0,
  "pipeline_stages": 0,
  "register_count": 0,
  "rom_bits": 0,
  "estimated_gate_count": 180,
  "fsm_states": [],
  "data_width_in": 8,
  "data_width_out": 8,
  "fixed_point_format": "N/A (unsigned 8-bit integers; 9-bit arithmetic intermediates)",
  "interface_protocol": "dedicated_pins",
  "output_timing": {
    "result": {"type": "combinational", "latency_cycles": 0}
  },
  "semantic_invariants": [
    {
      "id": "INV-ALU-ATOMIC-001",
      "description": "a, b, and op form one atomic combinational operation and result corresponds to that same tuple.",
      "ports_or_state": ["a", "b", "op", "result"],
      "golden_reference": "No golden model; Section 2 opcode equations",
      "tolerance": "exact bit equality",
      "validation_hook": "VCD sample of a, b, op, and result at each downstream capture edge"
    },
    {
      "id": "INV-ALU-MOD256-002",
      "description": "ADD and SUB wrap modulo 256 after full-width 9-bit evaluation.",
      "ports_or_state": ["a", "b", "op", "result", "add9", "diff9"],
      "golden_reference": "(a+b)&0xff and (a-b)&0xff equations in Section 4a",
      "tolerance": "exact bit equality",
      "validation_hook": "Exhaustive arithmetic sweep including ff+01 and 00-01"
    },
    {
      "id": "INV-ALU-OPMAP-003",
      "description": "Opcode encodings select ADD, SUB, AND, OR, XOR in the fixed order 000 through 100; reserved encodings return zero.",
      "ports_or_state": ["op", "result"],
      "golden_reference": "Section 2 opcode table",
      "tolerance": "exact bit equality",
      "validation_hook": "VCD opcode sweep over all eight encodings with asymmetric operands"
    }
  ],
  "feasible": true,
  "blocking_issues": []
}
```