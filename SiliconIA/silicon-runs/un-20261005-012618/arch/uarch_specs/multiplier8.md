# `multiplier8` Microarchitecture Specification

## 1. Block Overview

`multiplier8` is a stateless unsigned 8-bit by 8-bit combinational multiplier. It continuously computes the exact unsigned integer product of `a[7:0]` and `b[7:0]` on `product[15:0]`. The supplied requirements contain no ERS connection graph, frozen interface contract, neighboring-block specification, or Python golden model. Consequently, this specification defines the minimal dedicated-pin contract implied by the Spanish block description; no golden model constrains behavior.

Latency is 0 clock cycles (combinational propagation only). The conceptual synchronous throughput is one independent operand pair per clock cycle (1 sample/cycle) when surrounding logic samples at 50 MHz. The implementation has one combinational arithmetic stage and zero sequential pipeline registers. The interface protocol is simple dedicated pins: the requirement identifies a combinational multiplier and specifies neither a bus protocol nor flow control, so no valid/ready or AXI-Stream signals are present.

Numeric convention: both operands are **unsigned, 8-bit plain binary integers** in `[0,255]`; `product` is an unsigned, 16-bit plain binary integer. Signed multiplication is not supported by this chosen local interface.

## 2. Interface Specification

There is no clock or reset port: the block has no state. The requirement's synchronous active-low `rst_n` convention applies only when a block is stateful.

| Port | Direction | Width | Protocol | Description |
|---|---:|---:|---|---|
| `a` | input | 8 | Dedicated pin | Unsigned multiplicand, `a[7:0]`, binary integer in `[0,255]`. |
| `b` | input | 8 | Dedicated pin | Unsigned multiplier, `b[7:0]`, binary integer in `[0,255]`. |
| `product` | output | 16 | Dedicated pin | Unsigned exact product `unsigned(a) * unsigned(b)`, binary integer in `[0,65025]`. |

There is no transfer handshake. `a` and `b` are an atomic operand pair for the instant at which a downstream synchronous consumer samples `product`; their source must meet that consumer's setup/hold requirements after allowing for multiplier combinational delay.

## 3. Microarchitecture

### 3.1 Top-Level Block Diagram

```text
 a[7:0] ----------------------------------+ 
                                          | 
                                          v
                                    +-----------+
 b[7:0] --------------------------> | unsigned  | ----> product[15:0]
                                    |  8 x 8    |
                                    | multiplier|
                                    +-----------+

No clock, reset, storage, control FSM, or handshake logic
```

### 3.2 Datapath

The RTL shall use one combinational unsigned multiplication expression equivalent to:

```verilog
assign product = a * b;
```

Bit-width derivation and arithmetic policy:

| Stage | Operation and range | Width / format | Overflow, extension, rounding |
|---|---|---|---|
| Operand A | `a`, range `[0,255]` | 8-bit unsigned plain integer | No extension or conversion. |
| Operand B | `b`, range `[0,255]` | 8-bit unsigned plain integer | No extension or conversion. |
| Partial products / reduction | Eight 8-bit unsigned partial products reduced by synthesis | Internal implementation-defined combinational nodes; minimum exact mathematical range `[0,65025]` | Any internal extension required by the synthesis implementation is zero-extension. No truncation is permitted before the final result. |
| Result | `a * b`, maximum `255 * 255 = 65025` | 16-bit unsigned plain integer, because `ceil(log2(65025 + 1)) = 16` | Range-guaranteed; no overflow, saturation, wrapping, or rounding occurs. |

There is no fixed-point radix point (`fixed_point_format = N/A`). The result is a full-precision integer product, not a low-half multiply. The implementation must preserve operand unsignedness; RTL must not cast either operand to `signed`.

### 3.3 Control Logic

No FSM, counters, handshake, command pulse, or sequential control logic is required. `product` is driven solely by continuous combinational logic. The expression is complete for all input values, so no latch can be inferred.

The block is always active. Any input transition may propagate to `product`; a system that requires edge-aligned transactions must register the operands and/or result outside this block.

### 3.4 Storage Elements

There are no registers, arrays, FIFOs, ROMs, LUTs, scratchpads, or status bits.

- `flip_flop_budget`: **0 FF** (0 one-bit flip-flops).
- `sram_budget`: **0 bits / 0 KiB; no SRAM macros**.
- Machine-readable memory manifest: none, because this block contains no storage elements. No `# MEM` line is emitted.

## 4. Algorithm Mapping

No Python golden model was supplied. The hardware behavior is derived directly from the functional requirement, and no omitted golden is assumed.

| Functional description | Hardware mapping |
|---|---|
| 8-bit multiplicand | Input wire `a[7:0]`, interpreted as unsigned integer. |
| 8-bit multiplier | Input wire `b[7:0]`, interpreted as unsigned integer. |
| 8x8 combinational multiplication | Verilog-2005 unsigned `*` expression. Yosys may map it to an AND partial-product network and combinational adder/reduction logic in `sky130_fd_sc_hd`. |
| 16-bit output | Full 16-bit result wire `product[15:0]`; no output register or narrowing. |

### 4a. Cross-Block Semantic Invariants

There is no cross-block state, feedback loop, packet ordering, sideband, or context RAM. The following value invariant is nevertheless required at every observation of the dedicated pins.

| Invariant ID | Applies to ports/state | Golden reference point | Tolerance | Update/consume timing | Downstream dependency | Validation hook |
|---|---|---|---|---|---|---|
| `INV-MULTIPLY-UNSIGNED-001` | `a[7:0]`, `b[7:0]`, `product[15:0]`; no state | No golden model exists. Functional reference is `product == unsigned(a) * unsigned(b)`. | Exact equality for all 65,536 operand pairs. | Combinational: after propagation from any stable operand pair; sampled by an external receiver only after its setup time is met. | Every consumer of `product` relies on the full 16-bit unsigned product and on both operands belonging to the same observed pair. | Dump `a`, `b`, and `product` in VCD; exhaustive or randomized assertion `product === (a*b)` with known 0/1 inputs. |

Atomicity rule: `product` must never be formed from a retained operand or from a truncated product. Because this block captures no inputs, input-pair atomicity is an integration timing obligation rather than internal state management.

## 5. Reset and Initialization

No reset or initialization exists because the design contains no sequential or memory element. Therefore `rst_n` is intentionally absent from the module interface. There are no reset-completion, done, valid, empty, or packet-complete signals.

At time zero in a four-state simulator, `product` follows normal Verilog combinational unknown propagation if either operand contains `X` or `Z`; this is not a reset state. With known binary operand values, `product` is immediately defined after ordinary combinational settling.

## 6. Timing and Performance

The longest path is an operand input pin through the inferred 8x8 partial-product/reduction network to a `product` output pin. There are no register-to-register paths and no internal pipeline boundaries. An 8x8 unsigned multiplier is expected to fit comfortably inside the 20 ns period implied by the 50 MHz target in `sky130_fd_sc_hd`; post-synthesis static timing analysis is the acceptance measurement.

The block accepts no handshake and cannot backpressure. It processes every stable operand pair continuously. In a 50 MHz synchronous environment, one new pair may be launched and sampled per cycle, hence throughput is 50 million pairs/s (1 pair/cycle).

### 6.1 Throughput Budget

No FRD or `PERF-NNN` identifier was supplied. To make the implementation checkable, this specification defines `PERF-LOCAL-001` as the derived local integration requirement: support one operand pair per 50 MHz sampling cycle (maximum 1 cycle/pair at the system boundary).

- **Initiation Interval (II):** `II = 1` cycle/pair. No loop-carried recurrence or shared sequential resource exists.
- **Computed cycles/op:** `iterations × II + (pipeline_depth - 1) + drain + io_framing = 1 × 1 + (1 - 1) + 0 + 0 = 1` cycle/pair. Here `pipeline_depth = 1` denotes the sole combinational processing stage for throughput accounting; it does **not** add a registered latency.
- **FRD cross-reference:** no FRD `PERF-NNN` exists; `PERF-LOCAL-001` cap is 1 cycle/pair. Computed 1 cycle/pair **MEETS** this derived cap.
- **Binding constraint:** none from a recurrence. The only physical limiter is the combinational multiply delay; adding a registered pipeline stage is the lever if future STA at a higher target frequency requires it, but it would change the zero-cycle interface latency and is out of scope here.

```perf
{ "op_unit": "block", "target_clock_mhz": 50, "iterations": 1,
  "pipeline_chain": [["mul", 8]],
  "resources": [{"name": "unsigned_mul_8x8", "op": "mul", "width": 8, "instances": 1,
                 "uses_per_iter": 1}],
  "rec_cycles": [],
  "drain_cyc": 0, "io_framing_cyc": 0,
  "perf_req_id": "PERF-LOCAL-001", "perf_req_cyc_per_op": 1,
  "declared_cyc_per_op": 1 }
```

### 6a. Output Timing Contract

| Output port | Type | Pipeline latency | First valid cycle after reset | Timing declaration |
|---|---|---:|---|---|
| `product[15:0]` | combinational | 0 cycles | N/A — no reset and no state | For a stable known `a`/`b` pair, `product` becomes the matching product after combinational propagation in the same cycle. It is valid for an external clocked receiver only when it meets that receiver's setup/hold timing. |

Representative timing (the clock is an external sampling reference, not a port of `multiplier8`):

```wavedrom
{signal: [
  {name: 'sample_clk (external)', wave: 'p....'},
  {name: 'a[7:0]',                wave: 'x.=..', data: ['A']},
  {name: 'b[7:0]',                wave: 'x.=..', data: ['B']},
  {name: 'product[15:0]',         wave: 'x.=..', data: ['A*B']}
], head: {text: 'Combinational latency = 0 cycles; product settles in the same cycle as A and B'}}
```

## 7. Edge Cases and Corner Conditions

- `a = 0` or `b = 0` produces `product = 16'h0000`.
- `a = 8'hFF` and `b = 8'hFF` produces `product = 16'hFE01` (65,025), which fits without overflow.
- No arithmetic overflow is possible for two unsigned 8-bit operands and a 16-bit result. There is therefore no saturation, wrap, overflow flag, or rounding behavior.
- Values are unsigned. A producer intending two's-complement multiplication must explicitly convert/reinterpret outside this block; applying a signed expectation to these pins is an integration error.
- The block has no idle, empty, reset-complete, done, terminal, or packet behavior.
- Input `X`/`Z` values are outside the binary functional contract. Simulation follows the simulator's normal four-state multiplication behavior; hardware cannot guarantee a meaningful value for an electrically unknown input.

## 8. Implementation Notes

- Use `assign product = a * b;` or an exactly equivalent purely combinational implementation. Do not add `always @(posedge clk)`, reset logic, enables, inferred latches, or tri-states.
- Keep `a`, `b`, and `product` declared as unsigned `wire` vectors. In Verilog-2005, do not use a signed declaration or `$signed` cast unless the interface is intentionally revised for signed arithmetic.
- The `*` operator is synthesizable in Yosys. Let synthesis optimize the partial products for `sky130_fd_sc_hd`; do not instantiate technology-specific arithmetic cells for this small multiplier.
- STA must constrain the input-to-output combinational path relative to the integration sampling clock. Functional verification should include exhaustive all-operand-pair testing, with special checks for `0×N`, `1×N`, `255×255`, and asymmetric operands such as `3×200`.
- VCD contract audit signals: `a`, `b`, and `product`. There is no feedback/context state or selected-mode metadata to dump.

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
  "estimated_gate_count": 220,
  "fsm_states": [],
  "data_width_in": 8,
  "data_width_out": 16,
  "fixed_point_format": "N/A",
  "interface_protocol": "dedicated_pins",
  "output_timing": {
    "product": {"type": "combinational", "latency_cycles": 0}
  },
  "semantic_invariants": [
    {
      "id": "INV-MULTIPLY-UNSIGNED-001",
      "description": "product is the full exact unsigned product of the simultaneous a and b operand pair.",
      "ports_or_state": ["a[7:0]", "b[7:0]", "product[15:0]"],
      "golden_reference": "No Python golden model exists; functional relation product == unsigned(a) * unsigned(b).",
      "tolerance": "exact equality",
      "validation_hook": "VCD a/b/product plus exhaustive or randomized product assertion"
    }
  ],
  "feasible": true,
  "blocking_issues": []
}
```