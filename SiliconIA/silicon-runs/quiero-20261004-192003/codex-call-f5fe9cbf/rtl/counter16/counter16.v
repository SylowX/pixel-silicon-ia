/*
 * Block: counter16
 * Description: 16-bit unsigned modulo up-counter with enable and a
 *              synchronous active-low reset.
 *
 * I/O ports:
 *   clk          - rising-edge clock
 *   rst_n        - synchronous active-low reset
 *   enable       - increment enable; low holds the current count
 *   count[15:0]  - registered current counter value
 */
module counter16 (
    input  wire        clk,
    input  wire        rst_n,
    input  wire        enable,
    output wire [15:0] count
);

    /* Named state and next-value signals are retained for VCD auditing. */
    reg  [15:0] count_q;
    wire [16:0] count_increment_ext;
    wire [15:0] count_increment_wrapped;

    /*
     * The 17-bit sum preserves the carry for audit. Storing only [15:0]
     * implements the required modulo-65536 wrap. The output depends on the
     * prior count data through this increment path whenever enable is high.
     */
    assign count_increment_ext = {1'b0, count_q} + 17'd1;
    assign count_increment_wrapped = count_increment_ext[15:0];
    assign count = count_q;

    /* One registered update opportunity per cycle (latency 1, II 1). */
    always @(posedge clk) begin
        if (!rst_n) begin
            count_q <= 16'h0000;
        end else if (enable) begin
            count_q <= count_increment_wrapped;
        end else begin
            count_q <= count_q;
        end
    end

endmodule
