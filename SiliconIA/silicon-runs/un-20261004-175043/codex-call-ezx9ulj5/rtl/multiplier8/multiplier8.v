/*
 * Block: multiplier8
 * Description: Combinational unsigned 8-bit by 8-bit multiplier.
 *
 * I/O ports:
 *   a[7:0]       - Unsigned multiplicand.
 *   b[7:0]       - Unsigned multiplier.
 *   product[15:0]- Exact, full-width unsigned product of a and b.
 *
 * The sample inputs a[7:0] and b[7:0] directly feed product[15:0].
 * There is no state, clock, reset, metadata, error flag, or handshake.
 */
module multiplier8 (
    input  wire [7:0]  a,
    input  wire [7:0]  b,
    output wire [15:0] product
);

    /*
     * Explicit extension makes the unsigned expression width match the
     * 16-bit output. Since both upper halves are zero, the exact result is
     * bounded by 16'hfe01 and no result bit is truncated.
     */
    wire [15:0] a_unsigned_ext;
    wire [15:0] b_unsigned_ext;

    assign a_unsigned_ext = {8'b00000000, a};
    assign b_unsigned_ext = {8'b00000000, b};
    assign product = a_unsigned_ext * b_unsigned_ext;

endmodule
