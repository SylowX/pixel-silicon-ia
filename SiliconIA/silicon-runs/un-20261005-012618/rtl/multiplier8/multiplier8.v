/*
 * Block name : multiplier8
 * Description: Stateless combinational unsigned 8-bit by 8-bit multiplier.
 * I/O ports  : a[7:0] and b[7:0] are unsigned operands; product[15:0]
 *              is their exact unsigned product.  No clock, reset, or
 *              handshake is required because this block has no state.
 */
module multiplier8 (
    input  wire [7:0]  a,
    input  wire [7:0]  b,
    output wire [15:0] product
);

    /*
     * The explicit 16-bit zero extensions make the multiply expression and
     * its destination equally wide.  product therefore retains every
     * partial-product bit (0 through 15) without an implicit truncation.
     * a, b, and product are the complete VCD-auditable datapath.
     * DATA DEPENDENCY: product is directly computed from input samples a/b.
     */
    wire [15:0] a_zero_extended;
    wire [15:0] b_zero_extended;

    assign a_zero_extended = {8'b00000000, a};
    assign b_zero_extended = {8'b00000000, b};
    assign product = a_zero_extended * b_zero_extended;

endmodule
