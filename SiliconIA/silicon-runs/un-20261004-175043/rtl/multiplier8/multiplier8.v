/*
 * Block: multiplier8
 * Description: Combinational unsigned 8-bit by 8-bit multiplier with an
 *              exact full-width 16-bit product. The data inputs a[7:0] and
 *              b[7:0] directly determine product[15:0]; there is no state,
 *              clock, reset, packet metadata, or flow-control interface.
 *
 * I/O ports:
 *   a[7:0]       - unsigned multiplicand input
 *   b[7:0]       - unsigned multiplier input
 *   product[15:0]- unsigned full-precision product output
 */
module multiplier8 (
    input  wire [7:0]  a,
    input  wire [7:0]  b,
    output wire [15:0] product
);

    /*
     * Explicit zero extension makes the unsigned expression width match the
     * 16-bit output. All product bits are a direct function of a and b, which
     * keeps the complete arithmetic data path observable in a VCD.
     */
    wire [15:0] a_ext;
    wire [15:0] b_ext;

    assign a_ext   = {8'b00000000, a};
    assign b_ext   = {8'b00000000, b};
    assign product = a_ext * b_ext;

endmodule
