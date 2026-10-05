/*
 * Block: multiplier8
 * Description: Combinational unsigned 8-bit by 8-bit multiplier.
 *
 * I/O ports:
 *   a[7:0]        - Unsigned multiplicand input.
 *   b[7:0]        - Unsigned multiplier input.
 *   product[15:0] - Exact full-width unsigned product of a and b.
 *
 * All product bits are computed directly from the contemporaneous sample
 * bits a[7:0] and b[7:0]. There is no state, clock, reset, handshake,
 * metadata, packet boundary, or error flag in this combinational block.
 */
module multiplier8 (
    input  wire [7:0]  a,
    input  wire [7:0]  b,
    output wire [15:0] product
);

    /*
     * Explicit zero extension makes the multiplication expression exactly
     * 16 bits wide. The known-zero upper halves ensure the result is bounded
     * by 16'hfe01, so no arithmetic result bit is truncated.
     */
    wire [15:0] a_unsigned_ext;
    wire [15:0] b_unsigned_ext;

    assign a_unsigned_ext = {8'b00000000, a};
    assign b_unsigned_ext = {8'b00000000, b};
    assign product = a_unsigned_ext * b_unsigned_ext;

endmodule
