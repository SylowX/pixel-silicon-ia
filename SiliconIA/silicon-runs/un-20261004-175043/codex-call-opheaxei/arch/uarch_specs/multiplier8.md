## 1. Block Overview

- **Block name:** `multiplier8`
- **Function:** `multiplier8` is a purely combinational unsigned binary multiplier. It continuously computes the exact 16-bit product of two independent 8-bit operands. The block contains no state, clocked logic, control FSM, storage, initialization sequence, valid indication, or backpressure mechanism.
- **Latency:** 0 clock cycles; the output changes after the combinational propagation delay of the multiplier in the same observation cycle as an input change.
- **Throughput:** one 8-bit operand pair per surrounding-system clock cycle, or 1 result/cycle, provided the inputs meet the setup time of the downstream sampling register.
- **Pipeline depth:** one combinational arithmetic stage and zero registered pipeline boundaries.
- **Interface protocol:** simple dedicated pins, with no handshake. This follows the supplied block description, which explicitly calls for an 8x8-bit combinational multiplier, and the constraint that the design is combinational when no memory/registers are required. No ERS, frozen interface contract, architecture diagram, connection graph, FRD, or neighboring-block specification was supplied. This specification therefore locks the minimal port names and unsigned interpretation given in Section 2.
- **Clock/reset:** neither `clk` nor `rst_n` is a port because the block is stateless. The synchronous active-low reset requirement applies only to stateful implementations; adding a reset register would violate the required combinational behavior.

## 2. Interface Specification

| Port | Direction | Width | Protocol | Description |
|---|---:|---:|---|---|
| `a` | Input | 8 | Dedicated pin | Unsigned binary multiplicand, range 0 through 255. Continuously active; there is no valid qualifier. |
| `b` | Input | 8 | Dedicated pin | Unsigned binary multiplier, range 0 through 255. Continuously active; there is no valid qualifier. |
| `product` | Output | 16 | Dedicated pin | Unsigned exact product `a * b`, range 0 through 65025. Combinational and continuously valid after propagation delay. |

The operand pair is atomic: a downstream sampler observes `product` for the values of `a` and `b` present during that same combinational evaluation interval. There is no packing, sideband, mode field, signed interpretation, packet ordering, or transaction handshake. The specification deliberately does not add `valid`, `ready`, `clk`, or reset ports absent from the supplied requirements.

## 3. Microarchitecture

### 3.1 Top-Level Block Diagram

```text
 a[7:0] ----+     +---------------------------+
             +--->|                           |
                  |  unsigned 8 x 8 multiply |----> product[15:0]
             +--->|  one combinational stage |
 b[7:0] ----+     +---------------------------+

 Control, FSM, registers, clock, reset, and storage: none
```

### 3.2 Datapath

The datapath consists of one unsigned multiply operation:

1. Interpret `a[7:0]` and `b[7:0]` as unsigned, unscaled, plain binary integers. Neither input is signed and neither has fractional bits.
2. Compute the full-precision multiplication `a * b` as an 8-bit unsigned by 8-bit unsigned operation producing a 16-bit unsigned result.
3. Drive all 16 result bits directly onto `product[15:0]`. No bits are truncated or rounded.

**Bit-width derivation:**

- `a` range: `[0, 2^8-1] = [0, 255]`.
- `b` range: `[0, 2^8-1] = [0, 255]`.
- Product range: `[0, 255*255] = [0, 65025]`.
- The required unsigned result width is `ceil(log2(65025+1)) = 16` bits.
- Operation width is therefore exactly `8 unsigned x 8 unsigned -> 16 unsigned`.

All ports use plain integer format; Q notation is not applicable. There is no signed extension. If the RTL author introduces intermediate operands to make Verilog expression sizing explicit, each input shall be zero-extended to 16 bits before multiplication; synthesis may optimize the known-zero upper bits back to an 8x8 implementation. The mathematical result already fits 16 bits, so overflow cannot occur, saturation is unnecessary, wraparound is forbidden, and no rounding is performed.

### 3.3 Control Logic

No control logic or FSM is required. The block is always active and evaluates the same expression for every input combination. No control decision is decoded or retained, so the latched-control-decision rule is not applicable.

There are no start/done pulses, commands, bridge states, status registers, or module-boundary handshakes. Consequently, command acceptance, completion clearing, and decomposition-boundary timing rules do not apply. A downstream synchronous block may sample `product` on any rising edge for which `a` and `b` met its combinational-path timing requirements.

### 3.4 Storage Elements

The implementation contains no registers, arrays, FIFOs, ROMs, LUT memories, scratchpads, or SRAMs. A synthesis result containing any inferred latch, flip-flop, or memory cell is non-conforming.

- `flip_flop_budget = 0 FF` (0 bit-level flip-flops).
- `sram_budget = 0 bits (0 KiB), 0 macros`.
- Memory manifest: empty, because the block has no storage element.

No `# MEM` records are emitted because there are no memory structures to price.

## 4. Algorithm Mapping

No Python golden model exists, and none is assumed or invented. The hardware mapping is derived solely from the functional description:

| Functional operation | Hardware equivalent |
|---|---|
| Read two 8-bit operands | Continuously driven dedicated inputs `a[7:0]` and `b[7:0]` |
| Multiply the operands | One unsigned combinational Verilog multiply operator with full 16-bit result preservation |
| Return the 16-bit result | Continuously drive `product[15:0]`; no register or handshake |

There are no loops, arrays, dictionaries, exceptions, dynamic objects, casts, shifts, clips, or rounding operations to map.

### 4a. Cross-Block Semantic Invariants (MANDATORY)

No connection graph or named neighboring blocks were supplied. The following invariant is nevertheless required so that any downstream consumer receives the defined arithmetic value:

- **Invariant ID:** `INV-MUL-ATOMIC-001`
- **Applies to ports/state:** `a[7:0]`, `b[7:0]`, and `product[15:0]`; there is no internal state.
- **Invariant:** `product` equals the full unsigned product of the contemporaneous operand pair: `product == unsigned(a) * unsigned(b)`. The result may not combine an old value of one operand with a new value of the other through any intentional storage or sequencing.
- **Golden reference point:** no golden model exists; the reference point is the mathematical equation above for each stable input pair.
- **Tolerance:** exact equality across all 65,536 input combinations; zero numeric tolerance.
- **Update/consume timing:** continuous combinational update. A consumer samples the result only after the input-to-output propagation delay has elapsed, normally at the surrounding system's next active clock edge.
- **Downstream dependency:** any connected consumer depends on all 16 product bits, including upper bits `product[15:8]`; truncation would corrupt products greater than 255.
- **Validation hook:** dump top-level `a`, `b`, and `product` in VCD and assert `product === a*b` whenever `a` and `b` contain no unknown bits.

Because the block has no metadata, mode, ordering state, reconstruction loop, predictor context, adaptive state, or storage, there are no additional cross-block stateful invariants to preserve.

## 5. Reset and Initialization

The block has no reset port and no initialization behavior because it contains no sequential state. The active-low synchronous-reset convention is therefore not instantiated.

- Registers: none.
- Memories: none.
- Multi-cycle initialization: none.
- Reset-idle/completion distinction: not applicable; there are no idle, done, drained, complete, valid, or terminal flags.

If the surrounding chip is in reset, `product` still reflects `a * b`. Integration must not rely on this block to suppress or zero its output during reset. Unknown input bits propagate according to normal four-state Verilog multiplication semantics; no hidden reset value is substituted.

## 6. Timing and Performance

- **Target frequency:** 50 MHz, corresponding to a 20 ns surrounding-system clock period.
- **Critical path:** `a`/`b` input pin -> synthesized unsigned 8x8 multiplier partial-product generation and reduction -> `product` output pin. There are no cascaded operations before or after the multiply.
- **Pipeline boundaries:** none; the full 8x8 multiplication is one bounded combinational stage.
- **Timing expectation:** an 8x8 unsigned multiplier is expected to fit within 20 ns in `sky130_fd_sc_hd`. Static timing analysis after synthesis and placement is authoritative. If that single operation unexpectedly exceeds 20 ns, registering it would change the frozen latency/interface behavior and must be treated as an architecture revision, not an invisible implementation change.
- **Throughput:** the logic can evaluate a new operand pair every surrounding-system cycle. There is no internal busy interval or resource reuse across cycles.
- **Backpressure:** not applicable; dedicated pins have no flow control.

### 6.1 Throughput Budget (MANDATORY — cross-reference the FRD PERF-NNN)

No FRD and therefore no external `PERF-NNN` identifier or cycles/op cap was supplied. To keep the result mechanically checkable, this specification defines local derived requirement `PERF-DERIVED-001`: sustain one multiplication result per 50 MHz observation cycle, with a cap of 1 cycle/op. This identifier is explicitly a specification-local substitute, not a claim that an FRD requirement existed.

- **Unit of work:** one pair `(a,b)` and its 16-bit product.
- **Iterations:** 1 multiplication per unit of work.
- **Initiation interval:** `II = 1`; new operands may be presented every surrounding-system cycle.
- **Logical pipeline depth for the throughput formula:** 1 combinational stage. Registered latency remains 0 cycles.
- **Drain:** 0 cycles.
- **I/O framing:** 0 cycles.
- **Computed cycles/op:** `iterations x II + (pipeline_depth - 1) + drain + io_framing = 1 x 1 + (1 - 1) + 0 + 0 = 1 cycle/op`.
- **Requirement comparison:** 1 cycle/op is less than or equal to the `PERF-DERIVED-001` cap of 1 cycle/op: **MEETS**.
- **Binding constraint:** the propagation delay of the single 8x8 combinational multiplier. There is no recurrence or shared multi-cycle resource. The only relaxation lever would be pipelining, which is neither necessary at 50 MHz nor allowed without changing the specified latency and ports.

```perf
{ "op_unit": "operand_pair", "target_clock_mhz": 50, "iterations": 1,
  "pipeline_chain": [["mul", 8]],
  "resources": [{"name": "mul8", "op": "mul", "width": 8, "instances": 1,
                 "uses_per_iter": 1}],
  "rec_cycles": [],
  "drain_cyc": 0, "io_framing_cyc": 0,
  "perf_req_id": "PERF-DERIVED-001", "perf_req_cyc_per_op": 1,
  "declared_cyc_per_op": 1 }
```

### 6a. Output Timing Contract (MANDATORY)

| Output | Type | Pipeline latency | First valid cycle after reset |
|---|---|---:|---:|
| `product[15:0]` | Combinational | 0 cycles | 0; there is no reset port, so the output is valid as soon as known `a` and `b` have propagated through the multiplier |

`product` has no associated valid signal. “Valid” in this table means numerically settled for stable, fully known inputs, not a protocol event. The `clk_ref` trace below is an integration timing reference and is not a module port.

```wavedrom
{signal: [
  {name: 'clk_ref', wave: 'p.....'},
  {name: 'a',       wave: 'x=.=..', data: ['A', 'C']},
  {name: 'b',       wave: 'x=.=..', data: ['B', 'D']},
  {name: 'product', wave: 'x=.=..', data: ['A*B', 'C*D']}
],
 head: {text: 'Combinational output: latency = 0 cycles; product settles in the same cycle'}}
```

The small analog propagation interval after an operand transition is abstracted by the WaveDrom equality marker. A synchronous consumer must satisfy its setup requirement using the post-layout maximum delay of this combinational path.

## 7. Edge Cases and Corner Conditions

- `0 * X` and `X * 0` produce 16'h0000 for every known 8-bit `X`.
- `1 * X` and `X * 1` reproduce `X` zero-extended to 16 bits.
- The maximum product is `8'hFF * 8'hFF = 16'hFE01` (65025), proving that 16 output bits are sufficient.
- Products greater than 255 retain their upper eight bits; no truncation is permitted.
- There is no overflow, saturation, underflow, sign conversion, or rounding.
- Inputs are unsigned. For example, `8'hFF * 8'h02 = 16'h01FE`, not a signed result.
- If either operand contains `X` or `Z`, standard four-state multiplication may produce unknown bits in `product`. The block shall not coerce unknowns to zero.
- First sample after chip-level reset deassertion requires no warm-up cycle because the block has no reset or state.
- Empty, idle, packet boundary, and completion behavior are not applicable.
- Simultaneous changes on `a` and `b` may cause transient combinational glitches before settling. The downstream consumer must sample only after timing closure guarantees settling; glitch-free asynchronous use is not promised.

## 8. Implementation Notes

- Use Verilog-2005 synthesizable combinational logic, preferably one continuous assignment. Do not add an `always @(posedge clk)` block, inferred latch, output register, handshake, or FSM.
- Make unsigned intent and full result width explicit. A robust implementation may zero-extend both operands to 16 bits before `*`; Yosys should optimize the known-zero upper bits. Verify `a=8'hFF`, `b=8'hFF` produces `16'hFE01` to catch accidental 8-bit expression truncation.
- Do not declare `a` or `b` as `signed`. No `$signed` cast is allowed in the multiplication path.
- Use no tri-state assignments, asynchronous reset constructs, delays, real numbers, floating point, unsized arithmetic constants in the datapath, or non-synthesizable system tasks.
- The arithmetic precision review is complete: both input ranges and the output range are derived, no Q format is used, width reduction is absent, and the full result is range-guaranteed.
- Suggested exhaustive DV is only 65,536 operand pairs and should compare every `product` against a testbench integer multiplication masked to 16 bits. Directed cases should include `(0,0)`, `(0,255)`, `(1,255)`, `(2,255)`, `(127,128)`, `(128,128)`, `(254,255)`, and `(255,255)`.
- Synthesis review shall confirm 0 inferred latches, 0 flip-flops, 0 memories, one combinational multiply cone, and no unintended clock/reset ports.
- Timing review shall constrain the input-to-output combinational path consistently with the surrounding 50 MHz integration environment.
- Contract audit/VCD signals: `a`, `b`, and `product` are sufficient to prove `INV-MUL-ATOMIC-001`; there is no hidden state to dump.
- The gate-count estimate in the JSON summary is intentionally approximate. Actual area depends on Yosys/ABC decomposition into `sky130_fd_sc_hd` cells and must be taken from synthesis.

## 9. Verilog Interface Stub

```verilog
module multiplier8 (
    input  wire [7:0]  a,
    input  wire [7:0]  b,
    output wire [15:0] product
);
endmodule
```

```json
{
  "block_name": "multiplier8",
  "latency_cycles": 0,
  "throughput_samples_per_cycle": 1.0,
  "pipeline_stages": 1,
  "register_count": 0,
  "rom_bits": 0,
  "estimated_gate_count": 500,
  "fsm_states": [],
  "data_width_in": 8,
  "data_width_out": 16,
  "fixed_point_format": "N/A (unsigned integer)",
  "interface_protocol": "dedicated_pins",
  "output_timing": {
    "product": {"type": "combinational", "latency_cycles": 0}
  },
  "semantic_invariants": [
    {
      "id": "INV-MUL-ATOMIC-001",
      "description": "product is the exact full-width unsigned multiplication of the contemporaneous a and b inputs",
      "ports_or_state": ["a", "b", "product"],
      "golden_reference": "No golden model exists; mathematical reference is unsigned(a) * unsigned(b)",
      "tolerance": "exact equality",
      "validation_hook": "VCD-visible a, b, and product; assert product === a*b for known inputs"
    }
  ],
  "feasible": true,
  "blocking_issues": []
}
```
