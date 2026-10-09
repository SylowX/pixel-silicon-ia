# `alu8` Microarchitecture Specification

## 1. Block Overview

**Block name:** `alu8`

`alu8` is an unsigned, bitwise 8-bit arithmetic-logic unit.  It evaluates one
of five selected operations on operands `a[7:0]` and `b[7:0]`: addition,
subtraction, AND, OR, or XOR.  The output is the low eight bits of the selected
operation.  The requirement supplies neither an ERS connection graph nor a
frozen interface contract, so the ports below are the minimal unambiguous
dedicated-pin interface implied by the block description.  It also supplies no
Python golden model; the operation table in this document is the functional
reference for RTL and DV.

- **Latency:** 0 cycles; `result` is combinational.
- **Throughput:** one independently stable operand/opcode set per enclosing
  system clock cycle (1 operation/cycle at the stated 50 MHz integration rate).
- **Pipeline depth:** 0 registered stages; one combinational arithmetic stage.
- **Interface protocol:** dedicated pins, with no valid/ready or bus protocol.
  A stateless combinational implementation is selected because the requirement
  explicitly permits combinational logic when no memory or registers are
  required.  The stated synchronous active-low `rst_n` convention therefore
  does not create a reset port for this stateless block.

## 2. Interface Specification

There is no handshaking: input values must be stable for the combinational
input-to-output delay required by the enclosing timing constraint.  `result` is
always meaningful for every 3-bit `op` encoding, including the defined-invalid
encodings.

| Port | Direction | Width | Protocol | Description |
|---|---:|---:|---|---|
| `a` | input | 8 bits | dedicated combinational pin | Unsigned operand A, `a[7:0]`. Each bit is also used verbatim by the logical operations. |
| `b` | input | 8 bits | dedicated combinational pin | Unsigned operand B, `b[7:0]`. Each bit is also used verbatim by the logical operations. |
| `op` | input | 3 bits | dedicated combinational pin | Operation selector, encoded exactly as Table 2-1. |
| `result` | output | 8 bits | dedicated combinational pin | Selected 8-bit operation result. No carry, borrow, signed-overflow, or validity flag is part of the supplied functional scope. |

**Table 2-1 — `op[2:0]` encoding and result definition**

| `op` | Operation | `result[7:0]` definition |
|---|---|---|
| `3'b000` | ADD | `(a + b) mod 256` |
| `3'b001` | SUB | `(a - b) mod 256` |
| `3'b010` | AND | `a & b` |
| `3'b011` | OR | `a | b` |
| `3'b100` | XOR | `a ^ b` |
| `3'b101`, `3'b110`, `3'b111` | reserved/invalid | `8'h00` |

There are no `clk` or `rst_n` ports because no sequential state exists.  If a
later integration contract requires registered I/O, it is an interface change,
not an implementation substitution: it must add `clk` and `rst_n` and revise
the specified latency from zero to at least one cycle.

## 3. Microarchitecture

### 3.1 Top-Level Block Diagram

```text
 a[7:0] ----+--------------------> [8-bit AND] ---+
            |--------------------> [8-bit OR ] ---+-->
 b[7:0] ----+--------------------> [8-bit XOR] ---+    5:1 + default
            |                                      |    result mux ----> result[7:0]
            +--> [8-bit add/subtract, 9-bit sum] --+          ^
                                                     |          |
 op[2:0] ---> [operation decode / invalid decode] ---+----------+
```

All boxes are combinational.  The selected arithmetic result, logical result,
and invalid-opcode zero value feed one total `case` mux.  No clocks, reset
trees, latches, storage, or feedback paths are present.

### 3.2 Datapath

The ports represent **plain unsigned 8-bit integers** for ADD/SUB.  AND, OR,
and XOR are bitwise operations on the same 8-bit vectors.  There is no
fixed-point quantity; every value is `U8` except the explicitly named
9-bit temporary below.

**Bit-width derivation and arithmetic behavior**

| Signal / expression | Width and format | Range / construction | Overflow, rounding, extension |
|---|---|---|---|
| `a`, `b` | 8-bit `U8` | 0 through 255 | Inputs are neither sign-extended nor reinterpreted as signed. |
| `sub_sel` | 1 bit | `1` only when `op == 3'b001`; otherwise `0` | Pure decode. |
| `b_eff` | 8-bit unsigned bit vector | `sub_sel ? ~b : b` | Bitwise complement for subtraction; no width change. |
| `arith_ext` | 9-bit `U9` | `{1'b0,a} + {1'b0,b_eff} + sub_sel` | Both 8-bit operands are zero-extended to 9 bits before addition.  The ninth bit is deliberately discarded because the interface has no carry/borrow output. |
| `add_result`, `sub_result` | 8-bit `U8` | `arith_ext[7:0]` under the corresponding opcode | Explicit modulo-256 wrap.  ADD carry-out and SUB no-borrow/borrow information are not observable. |
| `and_result`, `or_result`, `xor_result` | 8-bit bit vectors | `a & b`, `a | b`, `a ^ b` | No arithmetic overflow or rounding. |
| `result` | 8-bit `U8` / bit vector | One selected candidate, or `8'h00` for reserved opcode | No truncation beyond the deliberate `arith_ext[7:0]` extraction; no saturation and no rounding. |

The shared add/subtract calculation is algebraically `a + b` for ADD and
`a + (~b) + 1`, equivalent to `a - b` modulo 256, for SUB.  It may be
implemented as a single 9-bit carry-chain adder with conditional inversion of
`b`; separate add and subtract operators are not required.  The three logical
candidates may be generated in parallel.  A fully specified combinational
`case (op)` must assign `result` for all eight selector values, with a default
of `8'h00`, so no latch can be inferred.

### 3.3 Control Logic

No FSM is used or needed.  `op` is decoded combinationally in the same input
stability window in which it is consumed; it is not a multi-cycle control
decision and therefore requires no control register.

Combinational control rules:

1. Compute `sub_sel = (op == 3'b001)`.
2. Form the shared 9-bit arithmetic candidate and the three 8-bit logical
   candidates.
3. Select exactly one result using the Table 2-1 decode.
4. For `3'b101` through `3'b111` (and as a defensive `default` in RTL), drive
   `result = 8'h00`.

There is no START/DONE sequence, busy indication, status register, backpressure,
or input/output handshake.  There are likewise no boundary bridge/wait states
or registered pin adapters to add latency.

### 3.4 Storage Elements

There are no registers, arrays, FIFOs, LUTs, ROMs, SRAMs, or other state
elements.  An `always @*` implementation must use temporary combinational
variables only and must give `result` a value on every path.

- `flip_flop_budget`: **0 FF**.  The design contains no clocked state.
- `sram_budget`: **0 bits / 0 KiB; no macros**.  The block contains no storage
  structure, so no `# MEM` manifest line is emitted.
- Storage implementation: not applicable.  No flop array or raw `reg mem[]`
  array is permitted or needed.

## 4. Algorithm Mapping

No Python golden model was supplied.  The mapping below derives directly from
the functional description and the opcode table in Section 2; no unstated
software behavior is being transcribed.

| Functional operation | Hardware mapping | Precision / edge behavior |
|---|---|---|
| `a + b` | One 9-bit zero-extended carry-chain addition; select bits `[7:0]` | Exact modulo-256 sum; bit 8 discarded. |
| `a - b` | Set `sub_sel`; invert `b`; add carry-in `1` in the same 9-bit adder | Exact two's-complement modulo-256 difference; borrow not exported. |
| `a & b` | Eight parallel 2-input AND gates | Exact per-bit Boolean AND. |
| `a | b` | Eight parallel 2-input OR gates | Exact per-bit Boolean OR. |
| `a ^ b` | Eight parallel 2-input XOR gates | Exact per-bit Boolean XOR. |
| opcode selection | 3-to-8 decode / total 8-bit result mux | Reserved encodings deterministically select zero. |

### 4a. Cross-Block Semantic Invariants (MANDATORY)

No connection graph or neighboring block specification was supplied, so there
is no stateful cross-block feedback, frame ordering, metadata atomicity, or
closed-loop reconstruction invariant to preserve.  The following externally
observable invariant is still mandatory for any future consumer of `result`.

| Invariant ID | Applies to ports/state | Golden reference point | Tolerance | Update/consume timing | Downstream dependency | Validation hook |
|---|---|---|---|---|---|---|
| `INV-ALU8-OP-DECODE-001` | `a[7:0]`, `b[7:0]`, `op[2:0]`, `result[7:0]`; no internal state | Section 2, Table 2-1 (no Python golden exists) | Exact 8-bit equality, including modulo-256 arithmetic and zero for all reserved opcodes | After the combinational propagation delay whenever any input changes; sampled by a synchronous neighbor at its active clock edge if used in a clocked system | Any consumer treating `result` as the selected ALU outcome | Dump `a`, `b`, `op`, and `result` in VCD; assert the Table 2-1 expression continuously or at each enclosing clock sample. |

Atomicity rule: `result` must be a function of one simultaneous stable tuple
`{a,b,op}`.  A consumer must not change `op` independently of operands within
the data's setup/hold window, because no input register exists to associate
values from separate cycles.

## 5. Reset and Initialization

This block has no sequential elements or memory, hence no initialization
sequence and no reset port.  The requirement's reset convention is observed by
not instantiating an unnecessary state element: no asynchronous reset, latch,
or reset synchronizer exists.

Immediately after chip-level reset release, `result` reflects the current
stable values of `a`, `b`, and `op` after combinational propagation.  It does
not signal completion, valid, packet termination, or any reset-derived event.

## 6. Timing and Performance

The target integration clock is 50 MHz (20 ns period).  The longest expected
combinational path is `a/b -> conditional B inversion and carry-in selection
-> 9-bit ripple/carry-chain add-subtract -> 5:1 result mux -> result` for
ADD/SUB.  Logical operations instead traverse one 2-input gate plus the result
mux.  In `sky130_fd_sc_hd`, this small path is expected to fit comfortably
inside 20 ns; synthesis STA must nevertheless constrain and check the actual
input-to-output path because the block has no registering endpoints.

- **Stage boundaries:** no registered boundaries.  The single logical
  combinational operation stage contains the candidate operations and output
  mux.
- **Throughput:** a system may present a new stable `{a,b,op}` tuple before
  every active edge of its 50 MHz clock and sample the corresponding result at
  that edge, giving one operation per clock.
- **Backpressure:** none.  There are no handshaked interfaces.

### 6.1 Throughput Budget (MANDATORY)

No FRD and no named `PERF-NNN` requirement were supplied.  This budget records
the directly stated 50 MHz integration target as `PERF-N/A` and uses a
one-operation-per-enclosing-cycle acceptance contract.

- **Initiation Interval (II):** `1` enclosing system cycle.  There is no
  recurrence, sequential resource, or handshake that can force II above one.
- **Computed cycles/op:** `iterations × II + (logical_pipeline_depth - 1) +
  drain + io_framing = 1 × 1 + (1 - 1) + 0 + 0 = 1` cycle/op at a synchronous
  integration sample point.  The output's combinational propagation latency is
  separately specified as 0 cycles in Section 6a.
- **FRD cross-reference:** `PERF-N/A` (no FRD ID/cycle cap supplied).  The
  computed rate is 1 operation/cycle = 50 million operations/s at 50 MHz, and
  meets the only supplied rate context.
- **Binding constraint:** the 9-bit carry-chain plus selection mux sets the
  input-to-output delay, not a loop-carried recurrence.  If a future higher
  frequency cannot close timing, the remedy is a registered one-cycle pipeline
  with an explicitly revised interface/timing contract, not serialization.

```perf
{ "op_unit": "block", "target_clock_mhz": 50, "iterations": 1,
  "pipeline_chain": [["mux", 8], ["add", 9], ["mux", 8]],
  "resources": [
    {"name": "add_sub", "op": "add", "width": 9, "instances": 1, "uses_per_iter": 1},
    {"name": "logic_select", "op": "mux", "width": 8, "instances": 1, "uses_per_iter": 1}
  ],
  "rec_cycles": [], "drain_cyc": 0, "io_framing_cyc": 0,
  "perf_req_id": "PERF-N/A", "perf_req_cyc_per_op": 1,
  "declared_cyc_per_op": 1 }
```

### 6a. Output Timing Contract (MANDATORY)

| Output port | Type | Pipeline latency | First valid cycle after reset | Timing declaration |
|---|---|---:|---|---|
| `result[7:0]` | combinational | 0 cycles | Not applicable: no reset port or state.  It is valid after normal combinational settling whenever its input tuple is stable. | `result = F(a,b,op)` in the same cycle; an enclosing sequential block must satisfy its setup time at its sampling edge. |

Representative combinational timing (the shown `clk` is the enclosing system
clock and is not an `alu8` port):

```wavedrom
{ "signal": [
  {"name":"clk (external)", "wave":"p....."},
  {"name":"a[7:0]",         "wave":"x.=.=.", "data":["A0","A1"]},
  {"name":"b[7:0]",         "wave":"x.=.=.", "data":["B0","B1"]},
  {"name":"op[2:0]",        "wave":"x.=.=.", "data":["ADD","XOR"]},
  {"name":"result[7:0]",    "wave":"x.=.=.", "data":["(A0+B0) mod 256","A1^B1"]}
], "head": {"text":"Combinational latency = 0 cycles; result settles in the same input-stable cycle."} }
```

## 7. Edge Cases and Corner Conditions

- **ADD overflow:** wraps modulo 256.  Example: `8'hFF + 8'h01` produces
  `8'h00`; carry-out is intentionally unobservable.
- **SUB underflow:** wraps modulo 256.  Example: `8'h00 - 8'h01` produces
  `8'hFF`; borrow is intentionally unobservable.
- **Signed interpretation:** none.  The unit operates on U8 values for
  arithmetic and raw bit vectors for Boolean operations.  It does not provide
  signed overflow detection.
- **Reserved opcodes:** every encoding in `3'b101` through `3'b111` produces
  `8'h00` deterministically; it must never retain a prior arithmetic result.
- **First input after reset:** no special case.  Since the ALU has no state,
  the first stable tuple is treated exactly like every other tuple.
- **Idle / empty / status behavior:** not applicable.  There are no valid,
  ready, done, busy, empty, frame, packet, or status signals.
- **Input transitions:** combinational hazards during changes are allowed
  inside propagation time.  Integrators must meet normal setup/hold timing and
  must sample only after inputs and `result` have settled.

## 8. Implementation Notes

- Use Verilog-2005 combinational logic (`always @*` or continuous assignments),
  never `always_ff`/`always_comb` language extensions if strict Verilog-2005
  compatibility is required.
- Give `result` a default `8'h00` before the `case`, and include `default`;
  this avoids inferred latches and makes reserved opcode behavior deterministic.
- Declare the 9-bit arithmetic expression explicitly (`wire [8:0] arith_ext`)
  rather than relying on unsized literal arithmetic.  The `1'b0` extensions and
  `sub_sel` carry-in preserve the specified modulo behavior in Yosys.
- Do not add tri-states, reset logic, clock gating, or a register merely to
  make use of the stated clock; each would violate the zero-cycle timing
  contract selected by the stateless requirement.
- Suggested DV points: exhaustively test all `256 × 256 × 8 = 524,288` input
  tuples, including the three reserved opcodes; check `result` against Table
  2-1.  At minimum include ADD overflow, SUB underflow, all-zero, all-one, and
  changing `op` with fixed operands.  Dump the four ports named by
  `INV-ALU8-OP-DECODE-001` in the VCD.

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
  "estimated_gate_count": 100,
  "fsm_states": [],
  "data_width_in": 8,
  "data_width_out": 8,
  "fixed_point_format": "N/A; U8 arithmetic and 8-bit Boolean vectors",
  "interface_protocol": "dedicated_pins",
  "output_timing": {
    "result": {"type": "combinational", "latency_cycles": 0}
  },
  "semantic_invariants": [
    {
      "id": "INV-ALU8-OP-DECODE-001",
      "description": "result equals the exact Table 2-1 operation of one stable {a,b,op} tuple; ADD/SUB wrap modulo 256 and reserved opcodes return zero.",
      "ports_or_state": ["a", "b", "op", "result"],
      "golden_reference": "No Python golden model supplied; Section 2 Table 2-1 is the normative functional reference.",
      "tolerance": "Exact 8-bit equality",
      "validation_hook": "VCD-visible a, b, op, result and a continuous or clock-sampled Table 2-1 assertion"
    }
  ],
  "feasible": true,
  "blocking_issues": []
}
```