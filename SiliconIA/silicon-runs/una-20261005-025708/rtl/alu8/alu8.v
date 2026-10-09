/*
 * Block: alu8
 * Description: Stateless combinational unsigned 8-bit ALU supporting add,
 *              subtract, AND, OR, and XOR. Reserved opcodes return zero.
 * I/O ports:
 *   a[7:0]      - unsigned operand A
 *   b[7:0]      - unsigned operand B
 *   op[2:0]     - operation selector
 *   result[7:0] - selected modulo-256 or bitwise result
 *
 * This interface specifies no state, so it deliberately has no clock/reset.
 */
module alu8 (
    input  wire [7:0] a,
    input  wire [7:0] b,
    input  wire [2:0] op,
    output reg  [7:0] result
);

    localparam [2:0] OP_ADD = 3'b000;
    localparam [2:0] OP_SUB = 3'b001;
    localparam [2:0] OP_AND = 3'b010;
    localparam [2:0] OP_OR  = 3'b011;
    localparam [2:0] OP_XOR = 3'b100;

    // Observable combinational decode and datapath candidates for VCD audit.
    wire       op_add;
    wire       op_sub;
    wire       op_and;
    wire       op_or;
    wire       op_xor;
    wire       sub_sel;
    wire       invalid_op;
    wire [7:0] b_eff;
    wire [8:0] a_ext;
    wire [8:0] b_eff_ext;
    wire [8:0] sub_carry_ext;
    wire [8:0] arith_ext;
    wire [7:0] add_result;
    wire [7:0] sub_result;
    wire [7:0] and_result;
    wire [7:0] or_result;
    wire [7:0] xor_result;

    assign op_add = (op == OP_ADD);
    assign op_sub = (op == OP_SUB);
    assign op_and = (op == OP_AND);
    assign op_or  = (op == OP_OR);
    assign op_xor = (op == OP_XOR);
    assign sub_sel = op_sub;
    assign invalid_op = !(op_add || op_sub || op_and || op_or || op_xor);

    // a/b samples feed every result candidate; arithmetic is U9 then wraps U8.
    assign b_eff = sub_sel ? ~b : b;
    assign a_ext = {1'b0, a};
    assign b_eff_ext = {1'b0, b_eff};
    assign sub_carry_ext = {8'b00000000, sub_sel};
    assign arith_ext = a_ext + b_eff_ext + sub_carry_ext;
    assign add_result = arith_ext[7:0];
    assign sub_result = arith_ext[7:0];
    assign and_result = a & b;
    assign or_result = a | b;
    assign xor_result = a ^ b;

    always @(*) begin
        case (op)
            OP_ADD:  result = add_result;
            OP_SUB:  result = sub_result;
            OP_AND:  result = and_result;
            OP_OR:   result = or_result;
            OP_XOR:  result = xor_result;
            default: result = 8'h00;
        endcase
    end

endmodule
