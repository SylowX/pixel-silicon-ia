# `counter16` Microarchitecture Specification

## 1. Block Overview

- **Block name:** `counter16`
- **Function:** `counter16` is a free-running-capable 16-bit unsigned binary up-counter. On every rising edge of `clk`, a sampled-low `rst_n` synchronously clears the count to zero; otherwise, a sampled-high `enable` increments the count by one modulo 65,536, and a sampled-low `enable` holds the prior count. The initial Spanish description requests an asynchronous reset, but the explicit implementation constraints require a synchronous active-low reset and prohibit asynchronous resets. Those explicit constraints govern this specification: the RTL sensitivity list shall contain only `posedge clk`.
- **Golden model:** No Python golden model exists. The transition rules in this document are derived only from the supplied functional description and explicit constraints; no omitted or hypothetical golden behavior is assumed.
- **Latency:** 1 clock cycle from sampling `enable` and the old counter state at a rising edge to the corresponding registered `count` value visible after that edge.
- **Throughput:** one counter-state update opportunity per clock cycle, or 1 sample/cycle at 50 MHz.
- **Pipeline depth:** one sequential stage (`count_q`).
- **Interface protocol:** simple dedicated pins. The requirements describe a continuously active counter and do not specify streaming, flow control, packets, or a bus. Consequently, there are no valid/ready signals and no backpressure.

## 2. Interface Specification

All inputs are sampled on each rising edge. `count` is driven directly from the 16-bit state register and is therefore a registered output. There is no interface contract file in the supplied workspace; the names below are the complete block interface derived from the request.

| Port | Direction | Width | Protocol | Description |
|---|---:|---:|---|---|
| `clk` | Input | 1 | Dedicated clock | Single rising-edge clock, target 50 MHz (20 ns period). |
| `rst_n` | Input | 1 | Dedicated synchronous control | Synchronous active-low reset. Sampled only on `posedge clk`; low has priority over `enable`. It is not in the event control/sensitivity list. |
| `enable` | Input | 1 | Dedicated data/control pin | When sampled high with `rst_n=1`, increments the counter once. When sampled low, holds the current count. |
| `count` | Output | 16 | Dedicated registered output | Current unsigned binary count, range 0 through 65,535. Driven from `count_q[15:0]`; wraps from `16'hFFFF` to `16'h0000`. |

There are no undeclared sidebands, completion flags, interrupts, handshake pins, or packet boundaries.

## 3. Microarchitecture

### 3.1 Top-Level Block Diagram

```text
                         +--------------------------+
 count_q[15:0] --------->| 16-bit incrementer       |
                         | {0,count_q} + 17'd1       |
                         +------------+-------------+
                                      | inc_ext[16:0]
                                      v
 enable ----------------------->+-----------+
 count_q[15:0] ---------------->| hold/inc  |---- next_count[15:0] ---+
                                |   mux     |                         |
                                +-----------+                         v
 rst_n -------------------------------------------------------+-------------+
 clk -------------------------------------------------------->| 16-bit      |----> count[15:0]
                                                             | count_q     |
                                                             | sync clear  |
                                                             +-------------+
```

Reset selection is the highest-priority synchronous D-input choice for `count_q`; it is not an asynchronous pin on the storage cells.

### 3.2 Datapath

The datapath has one 16-bit register and one 16-bit increment operation:

1. `count_q[15:0]` is an unsigned plain-integer value in `[0, 65535]`.
2. For explicit range analysis, zero-extend `count_q` to 17 bits and add a 17-bit unsigned constant: `inc_ext[16:0] = {1'b0, count_q[15:0]} + 17'd1`.
3. The exact mathematical range of `inc_ext` is `[1, 65536]`, requiring 17 unsigned bits.
4. `next_count[15:0] = inc_ext[15:0]`. Bit 16 is deliberately discarded, implementing unsigned modulo-2^16 wraparound. There is no saturation and no overflow flag.
5. With `enable=0`, `next_count[15:0] = count_q[15:0]` exactly.
6. With `rst_n=0`, the sequential update overrides both choices and loads `16'h0000`.

All numeric values are plain unsigned integers; fixed-point Q notation is not applicable. There are no signed conversions, multiplies, divides, shifts, rounding operations, or precision reductions other than the intentional discarded carry that defines wraparound.

**Bit-width derivation:** the externally visible state must represent 65,536 values, so `ceil(log2(65536)) = 16` state bits are necessary and sufficient. The addition is described at 17 bits so the carry behavior is explicit; only the low 16 bits are stored.

### 3.3 Control Logic

No FSM is needed. The same priority logic executes at every rising edge:

```text
if (rst_n == 0)      count_q := 16'h0000;
else if (enable)     count_q := count_q + 16'd1 modulo 2^16;
else                 count_q := count_q;
```

The required Verilog sequential form is `always @(posedge clk)`. `negedge rst_n` is forbidden. Reset wins if `rst_n=0` and `enable=1` on the same edge. Because there is no handshake, every non-reset clock edge is an update opportunity and the producer of `enable` need not wait for an acknowledgement.

The control inputs are consumed in the edge on which they are sampled; there are no decoded multi-cycle decisions to latch. There are no START, GO, DONE, busy, status, bridge, or wait states. The output pin is driven directly from the state register (continuous assignment or module output registered by that state), with no second pin-adapter register and therefore no decomposition-tax cycle.

### 3.4 Storage Elements

| Element | Width | Reset value | Update condition | Implementation |
|---|---:|---:|---|---|
| `count_q` | 16 bits | `16'h0000` | On every `posedge clk`: clear when `rst_n=0`; increment when `rst_n=1 && enable=1`; otherwise hold | 16 standard-cell flip-flops from `sky130_fd_sc_hd`, with synchronous D-path reset muxing |

There are no arrays, register files, FIFOs, buffers, scratchpads, tables, ROMs, or SRAMs. Therefore no `# MEM` manifest line is emitted: `count_q` is one named scalar state register, not an address-indexed memory. No `cs_fpmem_*`, `cs_sram_*`, or OpenRAM instance is required.

- `flip_flop_budget = 16 FF` (hard bit-level ceiling for architecturally required storage; synthesis may realize reset/enable in combinational cells, not additional state bits).
- `sram_budget = 0 bits (0 KiB), 0 macros` because every memory-like structure is absent and the only state is 16 bits.
- Actual declared storage arithmetic: `16 bits × 1 register = 16 one-bit flip-flops`.

## 4. Algorithm Mapping

No Python model was supplied and none exists. The functional statement maps to hardware as follows:

| Functional operation | Hardware equivalent |
|---|---|
| Maintain a 16-bit count | One 16-bit state register, `count_q[15:0]` |
| Reset counter | Highest-priority synchronous load of `16'h0000` when `rst_n` is sampled low |
| Enable counting | 2:1 hold/increment D-path selection controlled by `enable` |
| Add one | 16-bit incrementer; a conceptual 17-bit sum makes discarded carry explicit |
| Overflow at 65,535 | Modulo-65,536 wrap by storing `inc_ext[15:0]`; no saturation |
| Continuous observation | Direct registered output `count = count_q` |

The complete recurrence for edge number `N` is:

```text
count[N] = 0                                      if rst_n[N] = 0
count[N] = (count[N-1] + 1) mod 65536            if rst_n[N] = 1 and enable[N] = 1
count[N] = count[N-1]                             if rst_n[N] = 1 and enable[N] = 0
```

Here, inputs with index `N` mean values stable before and sampled at rising edge `N`; `count[N]` is the value visible immediately after edge `N`.

### 4a. Cross-Block Semantic Invariants (MANDATORY)

No neighboring blocks or connection graph were supplied, so no packet, metadata, coordinate, or feedback contract can be attributed to a named consumer. The following pin-level/state invariants are nevertheless mandatory for any connected consumer:

#### `INV-COUNT-RECURRENCE-001`

- **Applies to ports/state:** `clk`, `rst_n`, `enable`, `count`, and `count_q[15:0]`.
- **Invariant:** On each rising edge with `rst_n=1`, `count` increments exactly once modulo 65,536 if and only if `enable=1`; otherwise it does not change.
- **Golden reference point:** No golden model exists. Compare against the recurrence equation in Section 4 at every rising edge.
- **Tolerance:** Exact 16-bit equality.
- **Update/consume timing:** `rst_n`, `enable`, and the old `count_q` are sampled at edge `N`; the new `count` is visible after edge `N` and remains stable until a later updating edge.
- **Downstream dependency:** Any unnamed consumer observing elapsed enabled cycles relies on no duplicated, skipped, saturated, or reordered increments.
- **Validation hook:** Dump `clk`, `rst_n`, `enable`, `count_q[15:0]`, and `count[15:0]`; assert the recurrence on every rising edge.

#### `INV-RESET-ZERO-001`

- **Applies to ports/state:** `clk`, `rst_n`, `count_q[15:0]`, and `count[15:0]`.
- **Invariant:** A low `rst_n` affects state only on a rising edge and produces `count=16'h0000` immediately after that edge. Toggling `rst_n` between rising edges shall not asynchronously change `count`.
- **Golden reference point:** No golden model exists. Compare against the explicit synchronous-reset constraint and Section 3.3 priority rule.
- **Tolerance:** Exact 16-bit equality and edge alignment.
- **Update/consume timing:** Clear commits on each rising edge that samples `rst_n=0`; normal hold/increment behavior resumes on the first edge that samples `rst_n=1`.
- **Downstream dependency:** Any consumer relies on zero as the post-reset baseline and must not observe an asynchronous output transition caused solely by `rst_n`.
- **Validation hook:** Dump `rst_n` and `count_q`; toggle `rst_n` away from clock edges in DV and confirm `count_q` changes only at `posedge clk`.

There is no selected mode, predictor context, reconstruction feedback, adaptive state, atomic sideband, or payload ordering to preserve. The sole stateful feedback loop is the counter recurrence itself; using any value other than the prior registered `count_q` would violate `INV-COUNT-RECURRENCE-001` and cause all later counts to differ.

## 5. Reset and Initialization

- Reset is **synchronous, active low**. The only legal sequential event control is `always @(posedge clk)` followed by `if (!rst_n)`.
- `count_q[15:0]` resets to `16'h0000` on any rising edge that samples `rst_n=0`.
- `count` is driven by `count_q`, so it reads zero after the first reset-sampling rising edge.
- No multi-cycle initialization is required and no memory contents require initialization.
- While `rst_n` remains low, every rising edge reloads zero. Deasserting `rst_n` does not itself alter state; on the first subsequent rising edge, the block increments if `enable=1`, otherwise it holds zero.
- Before any rising edge has sampled asserted reset, simulation state may be unknown (`X`), as is normal for uninitialized synchronous state. The environment must present `rst_n=0` across at least one rising edge before relying on `count`.
- Reset-idle is not a completion event. The block has no `done`, `drained`, `frame_complete`, `packet_complete`, valid, or terminal flag, and none is to be inferred from `count==0`.

## 6. Timing and Performance

- **Clock target:** 50 MHz, period 20 ns.
- **Longest combinational path:** `count_q` clock-to-Q → 16-bit carry incrementer → enable hold/increment mux → synchronous reset mux → `count_q` setup. Depending on standard-cell mapping, Yosys may reorder or merge the muxes, but the Boolean priority must remain unchanged.
- **Pipeline boundary:** the sole boundary is `count_q`. No combinational output path exists from `enable` or `rst_n` to `count`.
- **Latency:** one registered edge. An `enable` value presented for edge `N` affects `count` visible immediately after edge `N`, defined as one cycle of registered input-to-output latency.
- **Throughput:** one update opportunity on every clock, so `1 update / 1 cycle = 1 sample/cycle = 50 million update opportunities/second` at 50 MHz.
- **Backpressure:** not applicable. Dedicated pins have no handshake and the block cannot stall. If `enable` remains high, it increments on every rising edge.
- **Timing expectation:** a 16-bit incrementer plus two 2:1 control selections is intentionally shallow relative to a 20 ns target in `sky130_fd_sc_hd`; static timing analysis remains the sign-off authority.

### 6.1 Throughput Budget (MANDATORY — `PERF-001`)

No external FRD or `PERF-NNN` requirement was supplied. Per the throughput-budget contract, this specification creates local requirement **`PERF-001`**: accept one enable/count update opportunity per cycle, with a cap of **1 cycle/op**.

- **Unit of work:** one evaluation of the reset/enable counter transition.
- **Initiation interval:** `II = 1`. The prior count is a loop-carried recurrence of distance 1 through one registered 16-bit add; its latency is one cycle, so `RecMII = ceil(1/1) = 1`. One incrementer performs one use per iteration, so `ResMII = ceil(1/1) = 1`.
- **Pipeline depth:** 1.
- **Computed cycles/op:** `iterations × II + (pipeline_depth - 1) + drain + io_framing = 1 × 1 + (1 - 1) + 0 + 0 = 1 cycle/op`.
- **Requirement comparison:** computed `1 cycle/op <= PERF-001 cap 1 cycle/op`; **MEETS**.
- **Binding constraint:** the count recurrence sets the theoretical floor at one edge per new state. Widening lanes cannot accelerate a single serial counter state and is unnecessary because II=1 already meets the cap.

```perf
{ "op_unit": "block", "target_clock_mhz": 50, "iterations": 1,
  "pipeline_chain": [["add", 16], ["mux", 16]],
  "resources": [{"name": "incrementer", "op": "add", "width": 16, "instances": 1,
                 "uses_per_iter": 1}],
  "rec_cycles": [{"name": "count_recurrence", "ops": [["add", 16]], "distance": 1}],
  "drain_cyc": 0, "io_framing_cyc": 0,
  "perf_req_id": "PERF-001", "perf_req_cyc_per_op": 1,
  "declared_cyc_per_op": 1 }
```

### 6a. Output Timing Contract (MANDATORY)

| Output port | Type | Pipeline latency | First valid cycle after reset | Timing rule |
|---|---|---:|---:|---|
| `count[15:0]` | Registered | 1 cycle | 0 cycles after deassertion, provided reset was sampled low on an earlier edge | The value is already valid as zero when reset is deasserted. An enabled transition sampled at edge `N` is visible after edge `N` and is treated mechanically as one registered cycle from the presented cycle to the output. It remains stable when disabled. |

The diagram labels values by the cycle interval following each rising edge. Reset is sampled low at the first two edges. It is deasserted before cycle 2; `enable` is high at edges 3 and 4, producing counts 1 and 2 in the corresponding post-edge intervals.

```wavedrom
{signal: [
  {name: 'clk',         wave: 'p.......'},
  {name: 'rst_n',       wave: '0.1.....'},
  {name: 'enable',      wave: '0..1.0..'},
  {name: 'count[15:0]', wave: '=..==...', data: ['0', '1', '2']}
],
 head: {text: 'Synchronous reset; registered count latency = 1 cycle'}}
```

There are no other output ports requiring a timing declaration.

## 7. Edge Cases and Corner Conditions

- **Overflow:** `16'hFFFF + 1` produces `16'h0000`; overflow wraps modulo 2^16. It never saturates and raises no flag.
- **Underflow:** impossible because there is no decrement operation.
- **Reset versus enable:** reset has priority. If `rst_n=0` and `enable=1` at a rising edge, the result is zero, not one.
- **First edge after reset deassertion:** if `enable=1`, count changes from zero to one; if `enable=0`, it remains zero.
- **Enable held high:** exactly one increment per rising edge, including after any number of consecutive enabled cycles.
- **Enable held low:** count remains bit-for-bit stable indefinitely.
- **Enable unknown (`X`) in simulation:** with `rst_n=1`, the next-state result may become unknown depending on RTL simulation semantics. The environment must drive `enable` to a known 0 or 1 around the sampling edge; hardware metastability from setup/hold violations is outside this synchronous contract.
- **Reset pulse missing a clock edge:** because reset is synchronous, a low pulse not spanning a rising edge has no effect. This is required behavior, not an error.
- **Idle/empty/completion:** `enable=0` means hold/idle only. `count==0` may mean reset or arithmetic wrap and must not be interpreted as completion. There are no status bits or event flags.
- **Immediately during reset assertion:** changing `rst_n` from high to low between edges does not change `count`; the clear occurs only at the next rising edge.

## 8. Implementation Notes

- Use Verilog-2005 constructs only. A single `reg [15:0] count_q` in one `always @(posedge clk)` block and a continuous assignment to `count` are sufficient.
- Do not write `always @(posedge clk or negedge rst_n)`; that would violate the synchronous-reset and no-asynchronous-reset requirements.
- Do not infer a latch, gated clock, tri-state, FSM, valid/ready protocol, overflow flag, or second output register.
- Use a nonblocking assignment for `count_q`. Make reset the first branch and enable the second branch. An explicit hold assignment is functionally legal but unnecessary; omitting the final `else` inside a clocked block infers a flip-flop hold, not a latch.
- Express the increment as `count_q + 16'd1` or equivalently retain the low 16 bits of the documented 17-bit conceptual sum. Unsized literals should be avoided to prevent accidental signed/width extension.
- The arithmetic policy is intentional unsigned wraparound. Do not add saturation logic.
- Sky130 synthesis should map the state to 16 `sky130_fd_sc_hd` flip-flops plus increment/mux logic. There is no clock gating and therefore no integrated-clock-gating cell requirement.
- **Verification points:** reset across a rising edge, reset pulse between edges, reset/enable priority, disabled hold, consecutive increments, and `16'hFFFE → 16'hFFFF → 16'h0000` wrap.
- **Contract audit/VCD:** dump `clk`, `rst_n`, `enable`, `count`, and internal `count_q`. If the implementation introduces an explicit `inc_ext`, dumping it is recommended to show carry discard at wrap.
- **Arithmetic review checklist:** input/state ranges are documented; the 17-bit extended sum is derived; all values are unsigned integers; carry truncation is explicitly wraparound; no rounding or Q-format applies; extreme/wrap vectors are required.
- There is no golden comparison beyond exact evaluation of the recurrence in Section 4. DV must not claim comparison to a nonexistent Python model.

## 9. Verilog Interface Stub

```verilog
module counter16 (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        enable,
    output wire [15:0] count
);
endmodule
```

```json
{
  "block_name": "counter16",
  "latency_cycles": 1,
  "throughput_samples_per_cycle": 1.0,
  "pipeline_stages": 1,
  "register_count": 16,
  "rom_bits": 0,
  "estimated_gate_count": 80,
  "fsm_states": [],
  "data_width_in": 1,
  "data_width_out": 16,
  "fixed_point_format": "N/A (unsigned integer)",
  "interface_protocol": "dedicated_pins",
  "output_timing": {
    "count": {"type": "registered", "latency_cycles": 1}
  },
  "semantic_invariants": [
    {
      "id": "INV-COUNT-RECURRENCE-001",
      "description": "On each rising edge outside reset, count increments exactly once modulo 65536 iff enable is high; otherwise it holds.",
      "ports_or_state": ["clk", "rst_n", "enable", "count", "count_q"],
      "golden_reference": "No golden model; Section 4 recurrence equation",
      "tolerance": "exact 16-bit equality",
      "validation_hook": "posedge recurrence assertion over rst_n, enable, count_q, and count"
    },
    {
      "id": "INV-RESET-ZERO-001",
      "description": "A sampled-low rst_n synchronously clears count to zero; rst_n never changes count asynchronously.",
      "ports_or_state": ["clk", "rst_n", "count", "count_q"],
      "golden_reference": "No golden model; explicit synchronous-reset requirement",
      "tolerance": "exact value and edge alignment",
      "validation_hook": "VCD check that count_q changes only on posedge clk and is zero after an edge sampling rst_n low"
    }
  ],
  "feasible": true,
  "blocking_issues": []
}
```