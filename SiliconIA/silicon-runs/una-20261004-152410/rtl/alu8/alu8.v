/*
 * Block: alu8
 * Description: Combinational 8-bit arithmetic/logic unit. ADD and SUB wrap
 *              modulo 256; reserved operation encodings produce zero.
 *
 * I/O ports:
 *   a[7:0]      - unsigned operand A
 *   b[7:0]      - unsigned operand B
 *   op[2:0]     - 000 ADD, 001 SUB, 010 AND, 011 OR, 100 XOR
 *   result[7:0] - combinational operation result
 *
 * Data-flow audit: every non-reserved result candidate below is computed
 * directly from input sample bits a[7:0] and b[7:0]. There is no state or
 * metadata lookup; op_is_reserved exposes invalid-decode activity in VCD.
 * The uArch contract specifies dedicated pins and no clock, reset, or stream
 * handshake for this stateless block.
 */
module alu8 (
    input  wire [7:0] a,
    input  wire [7:0] b,
    input  wire [2:0] op,
    output reg  [7:0] result
);

    /* Explicit extension makes arithmetic growth and modulo truncation clear. */
    wire [8:0] a_u9;
    wire [8:0] b_u9;
    wire [8:0] add9;
    wire [8:0] diff9;

    /* Named candidates remain visible for VCD datapath/opcode auditing. */
    wire [7:0] add_result;
    wire [7:0] sub_result;
    wire [7:0] and_result;
    wire [7:0] or_result;
    wire [7:0] xor_result;
    wire       op_is_reserved;

    assign a_u9 = {1'b0, a};
    assign b_u9 = {1'b0, b};
    assign add9 = a_u9 + b_u9;
    assign diff9 = a_u9 - b_u9;

    /* Constant bit selects explicitly implement modulo-256 arithmetic. */
    assign add_result = add9[7:0];
    assign sub_result = diff9[7:0];
    assign and_result = a & b;
    assign or_result = a | b;
    assign xor_result = a ^ b;
    assign op_is_reserved = (op == 3'b101) ||
                            (op == 3'b110) ||
                            (op == 3'b111);

    always @(*) begin
        result = 8'h00;
        case (op)
            3'b000: result = add_result;
            3'b001: result = sub_result;
            3'b010: result = and_result;
            3'b011: result = or_result;
            3'b100: result = xor_result;
            3'b101: result = 8'h00;
            3'b110: result = 8'h00;
            3'b111: result = 8'h00;
            default: result = 8'h00;
        endcase
    end

endmodule
