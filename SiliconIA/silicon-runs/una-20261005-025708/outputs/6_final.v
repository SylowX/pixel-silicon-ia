module alu8 (a,
    b,
    op,
    result);
 input [7:0] a;
 input [7:0] b;
 input [2:0] op;
 output [7:0] result;

 wire _000_;
 wire _001_;
 wire _002_;
 wire _003_;
 wire _004_;
 wire _005_;
 wire _006_;
 wire _007_;
 wire _008_;
 wire _009_;
 wire _010_;
 wire _011_;
 wire _012_;
 wire _013_;
 wire _014_;
 wire _015_;
 wire _016_;
 wire _017_;
 wire _018_;
 wire _019_;
 wire _020_;
 wire _021_;
 wire _022_;
 wire _023_;
 wire _024_;
 wire _025_;
 wire _026_;
 wire _027_;
 wire _028_;
 wire _029_;
 wire _030_;
 wire _031_;
 wire _032_;
 wire _033_;
 wire _034_;
 wire _035_;
 wire _036_;
 wire _037_;
 wire _038_;
 wire _039_;
 wire _040_;
 wire _041_;
 wire _042_;
 wire _043_;
 wire _044_;
 wire _045_;
 wire _046_;
 wire _047_;
 wire _048_;
 wire _049_;
 wire _050_;
 wire _051_;
 wire _052_;
 wire _053_;
 wire _054_;
 wire _055_;
 wire _056_;
 wire _057_;
 wire _058_;
 wire _059_;
 wire _060_;
 wire _061_;
 wire _062_;
 wire _063_;
 wire _064_;
 wire _065_;
 wire _066_;
 wire _067_;
 wire _068_;
 wire _069_;
 wire _070_;
 wire net1;
 wire net2;
 wire net3;
 wire net4;
 wire net5;
 wire net6;
 wire net7;
 wire net8;
 wire net9;
 wire net10;
 wire net11;
 wire net12;
 wire net13;
 wire net14;
 wire net15;
 wire net16;
 wire net17;
 wire net18;
 wire net19;
 wire net20;
 wire net21;
 wire net22;
 wire net23;
 wire net24;
 wire net25;
 wire net26;
 wire net27;

 sky130_fd_sc_hd__clkinv_1 _071_ (.A(net6),
    .Y(_006_));
 sky130_fd_sc_hd__clkinv_1 _072_ (.A(net5),
    .Y(_007_));
 sky130_fd_sc_hd__clkinv_1 _073_ (.A(net4),
    .Y(_008_));
 sky130_fd_sc_hd__clkinv_1 _074_ (.A(net3),
    .Y(_009_));
 sky130_fd_sc_hd__clkinv_1 _075_ (.A(net2),
    .Y(_010_));
 sky130_fd_sc_hd__nor2_1 _076_ (.A(net19),
    .B(net18),
    .Y(_011_));
 sky130_fd_sc_hd__or3b_1 _077_ (.A(net19),
    .B(net18),
    .C_N(net17),
    .X(_012_));
 sky130_fd_sc_hd__xor2_1 _078_ (.A(net14),
    .B(_012_),
    .X(_013_));
 sky130_fd_sc_hd__xor2_1 _079_ (.A(net13),
    .B(_012_),
    .X(_014_));
 sky130_fd_sc_hd__xor2_1 _080_ (.A(net12),
    .B(_012_),
    .X(_015_));
 sky130_fd_sc_hd__xor2_1 _081_ (.A(net11),
    .B(_012_),
    .X(_016_));
 sky130_fd_sc_hd__xor2_1 _082_ (.A(net10),
    .B(_012_),
    .X(_017_));
 sky130_fd_sc_hd__nand2_1 _083_ (.A(net1),
    .B(net9),
    .Y(_018_));
 sky130_fd_sc_hd__o21a_1 _084_ (.A1(net9),
    .A2(_012_),
    .B1(_018_),
    .X(_019_));
 sky130_fd_sc_hd__xnor2_1 _085_ (.A(_010_),
    .B(_017_),
    .Y(_020_));
 sky130_fd_sc_hd__maj3_1 _086_ (.A(_010_),
    .B(_017_),
    .C(_019_),
    .X(_021_));
 sky130_fd_sc_hd__xnor2_1 _087_ (.A(_009_),
    .B(_016_),
    .Y(_022_));
 sky130_fd_sc_hd__maj3_1 _088_ (.A(_009_),
    .B(_016_),
    .C(_021_),
    .X(_023_));
 sky130_fd_sc_hd__xnor2_1 _089_ (.A(_008_),
    .B(_015_),
    .Y(_024_));
 sky130_fd_sc_hd__maj3_1 _090_ (.A(_008_),
    .B(_015_),
    .C(_023_),
    .X(_025_));
 sky130_fd_sc_hd__xnor2_1 _091_ (.A(_007_),
    .B(_014_),
    .Y(_026_));
 sky130_fd_sc_hd__maj3_1 _092_ (.A(_007_),
    .B(_014_),
    .C(_025_),
    .X(_027_));
 sky130_fd_sc_hd__xnor2_1 _093_ (.A(_006_),
    .B(_013_),
    .Y(_028_));
 sky130_fd_sc_hd__maj3_1 _094_ (.A(_006_),
    .B(_013_),
    .C(_027_),
    .X(_029_));
 sky130_fd_sc_hd__xor2_1 _095_ (.A(net15),
    .B(_012_),
    .X(_030_));
 sky130_fd_sc_hd__lpflow_isobufsrc_1 _096_ (.A(net7),
    .SLEEP(_030_),
    .X(_031_));
 sky130_fd_sc_hd__xor2_1 _097_ (.A(net7),
    .B(_030_),
    .X(_032_));
 sky130_fd_sc_hd__nand2_1 _098_ (.A(_029_),
    .B(_032_),
    .Y(_033_));
 sky130_fd_sc_hd__nor2_1 _099_ (.A(_029_),
    .B(_032_),
    .Y(_034_));
 sky130_fd_sc_hd__nand2_1 _100_ (.A(_011_),
    .B(_033_),
    .Y(_035_));
 sky130_fd_sc_hd__nand2_1 _101_ (.A(net15),
    .B(net7),
    .Y(_036_));
 sky130_fd_sc_hd__or3b_1 _102_ (.A(net17),
    .B(net19),
    .C_N(net18),
    .X(_037_));
 sky130_fd_sc_hd__and3b_1 _103_ (.A_N(net19),
    .B(net18),
    .C(net17),
    .X(_038_));
 sky130_fd_sc_hd__nor3b_1 _104_ (.A(net17),
    .B(net18),
    .C_N(net19),
    .Y(_039_));
 sky130_fd_sc_hd__a21o_1 _105_ (.A1(_036_),
    .A2(_039_),
    .B1(_038_),
    .X(_040_));
 sky130_fd_sc_hd__o21ai_0 _106_ (.A1(net15),
    .A2(net7),
    .B1(_040_),
    .Y(_041_));
 sky130_fd_sc_hd__o221ai_1 _107_ (.A1(_034_),
    .A2(_035_),
    .B1(_036_),
    .B2(_037_),
    .C1(_041_),
    .Y(net26));
 sky130_fd_sc_hd__o21ai_0 _108_ (.A1(_027_),
    .A2(_028_),
    .B1(_011_),
    .Y(_042_));
 sky130_fd_sc_hd__a21o_1 _109_ (.A1(_027_),
    .A2(_028_),
    .B1(_042_),
    .X(_043_));
 sky130_fd_sc_hd__nand2_1 _110_ (.A(net14),
    .B(net6),
    .Y(_044_));
 sky130_fd_sc_hd__nor2_1 _111_ (.A(net14),
    .B(net6),
    .Y(_045_));
 sky130_fd_sc_hd__a21oi_1 _112_ (.A1(_039_),
    .A2(_044_),
    .B1(_038_),
    .Y(_046_));
 sky130_fd_sc_hd__o221ai_1 _113_ (.A1(_037_),
    .A2(_044_),
    .B1(_045_),
    .B2(_046_),
    .C1(_043_),
    .Y(net25));
 sky130_fd_sc_hd__o21ai_0 _114_ (.A1(_025_),
    .A2(_026_),
    .B1(_011_),
    .Y(_047_));
 sky130_fd_sc_hd__a21o_1 _115_ (.A1(_025_),
    .A2(_026_),
    .B1(_047_),
    .X(_048_));
 sky130_fd_sc_hd__nand2_1 _116_ (.A(net13),
    .B(net5),
    .Y(_049_));
 sky130_fd_sc_hd__nor2_1 _117_ (.A(net13),
    .B(net5),
    .Y(_050_));
 sky130_fd_sc_hd__a21oi_1 _118_ (.A1(_039_),
    .A2(_049_),
    .B1(_038_),
    .Y(_051_));
 sky130_fd_sc_hd__o221ai_1 _119_ (.A1(_037_),
    .A2(_049_),
    .B1(_050_),
    .B2(_051_),
    .C1(_048_),
    .Y(net24));
 sky130_fd_sc_hd__o21ai_0 _120_ (.A1(_023_),
    .A2(_024_),
    .B1(_011_),
    .Y(_052_));
 sky130_fd_sc_hd__a21o_1 _121_ (.A1(_023_),
    .A2(_024_),
    .B1(_052_),
    .X(_053_));
 sky130_fd_sc_hd__nand2_1 _122_ (.A(net12),
    .B(net4),
    .Y(_054_));
 sky130_fd_sc_hd__nor2_1 _123_ (.A(net12),
    .B(net4),
    .Y(_055_));
 sky130_fd_sc_hd__a21oi_1 _124_ (.A1(_039_),
    .A2(_054_),
    .B1(_038_),
    .Y(_056_));
 sky130_fd_sc_hd__o221ai_1 _125_ (.A1(_037_),
    .A2(_054_),
    .B1(_055_),
    .B2(_056_),
    .C1(_053_),
    .Y(net23));
 sky130_fd_sc_hd__o21ai_0 _126_ (.A1(_021_),
    .A2(_022_),
    .B1(_011_),
    .Y(_057_));
 sky130_fd_sc_hd__a21o_1 _127_ (.A1(_021_),
    .A2(_022_),
    .B1(_057_),
    .X(_058_));
 sky130_fd_sc_hd__nor2_1 _128_ (.A(net11),
    .B(net3),
    .Y(_059_));
 sky130_fd_sc_hd__nand2_1 _129_ (.A(net11),
    .B(net3),
    .Y(_060_));
 sky130_fd_sc_hd__a21oi_1 _130_ (.A1(_039_),
    .A2(_060_),
    .B1(_038_),
    .Y(_061_));
 sky130_fd_sc_hd__o221ai_1 _131_ (.A1(_037_),
    .A2(_060_),
    .B1(_061_),
    .B2(_059_),
    .C1(_058_),
    .Y(net22));
 sky130_fd_sc_hd__o21ai_0 _132_ (.A1(_019_),
    .A2(_020_),
    .B1(_011_),
    .Y(_062_));
 sky130_fd_sc_hd__a21o_1 _133_ (.A1(_019_),
    .A2(_020_),
    .B1(_062_),
    .X(_063_));
 sky130_fd_sc_hd__nor2_1 _134_ (.A(net10),
    .B(net2),
    .Y(_064_));
 sky130_fd_sc_hd__nand2_1 _135_ (.A(net10),
    .B(net2),
    .Y(_065_));
 sky130_fd_sc_hd__a21oi_1 _136_ (.A1(_039_),
    .A2(_065_),
    .B1(_038_),
    .Y(_066_));
 sky130_fd_sc_hd__o221ai_1 _137_ (.A1(_037_),
    .A2(_065_),
    .B1(_066_),
    .B2(_064_),
    .C1(_063_),
    .Y(net21));
 sky130_fd_sc_hd__o21a_1 _138_ (.A1(_011_),
    .A2(_039_),
    .B1(_018_),
    .X(_067_));
 sky130_fd_sc_hd__o22ai_1 _139_ (.A1(net1),
    .A2(net9),
    .B1(_038_),
    .B2(_067_),
    .Y(_068_));
 sky130_fd_sc_hd__o21ai_0 _140_ (.A1(_018_),
    .A2(_037_),
    .B1(_068_),
    .Y(net20));
 sky130_fd_sc_hd__nand2_1 _141_ (.A(net8),
    .B(net16),
    .Y(_069_));
 sky130_fd_sc_hd__xor2_1 _142_ (.A(net8),
    .B(net16),
    .X(_070_));
 sky130_fd_sc_hd__xnor2_1 _143_ (.A(_012_),
    .B(_070_),
    .Y(_000_));
 sky130_fd_sc_hd__or3_1 _144_ (.A(_031_),
    .B(_034_),
    .C(_000_),
    .X(_001_));
 sky130_fd_sc_hd__o21ai_0 _145_ (.A1(_031_),
    .A2(_034_),
    .B1(_000_),
    .Y(_002_));
 sky130_fd_sc_hd__nand2_1 _146_ (.A(_039_),
    .B(_070_),
    .Y(_003_));
 sky130_fd_sc_hd__o21ai_0 _147_ (.A1(net8),
    .A2(net16),
    .B1(_038_),
    .Y(_004_));
 sky130_fd_sc_hd__o211ai_1 _148_ (.A1(_037_),
    .A2(_069_),
    .B1(_003_),
    .C1(_004_),
    .Y(_005_));
 sky130_fd_sc_hd__a31o_1 _149_ (.A1(_011_),
    .A2(_001_),
    .A3(_002_),
    .B1(_005_),
    .X(net27));
 sky130_fd_sc_hd__clkdlybuf4s50_1 input1 (.A(a[0]),
    .X(net1));
 sky130_fd_sc_hd__clkdlybuf4s50_1 input10 (.A(b[1]),
    .X(net10));
 sky130_fd_sc_hd__clkdlybuf4s50_1 input11 (.A(b[2]),
    .X(net11));
 sky130_fd_sc_hd__clkdlybuf4s50_1 input12 (.A(b[3]),
    .X(net12));
 sky130_fd_sc_hd__clkdlybuf4s50_1 input13 (.A(b[4]),
    .X(net13));
 sky130_fd_sc_hd__clkdlybuf4s50_1 input14 (.A(b[5]),
    .X(net14));
 sky130_fd_sc_hd__clkdlybuf4s50_1 input15 (.A(b[6]),
    .X(net15));
 sky130_fd_sc_hd__clkdlybuf4s50_1 input16 (.A(b[7]),
    .X(net16));
 sky130_fd_sc_hd__clkdlybuf4s50_1 input17 (.A(op[0]),
    .X(net17));
 sky130_fd_sc_hd__clkdlybuf4s50_1 input18 (.A(op[1]),
    .X(net18));
 sky130_fd_sc_hd__clkdlybuf4s50_1 input19 (.A(op[2]),
    .X(net19));
 sky130_fd_sc_hd__clkdlybuf4s50_1 input2 (.A(a[1]),
    .X(net2));
 sky130_fd_sc_hd__clkdlybuf4s50_1 input3 (.A(a[2]),
    .X(net3));
 sky130_fd_sc_hd__clkdlybuf4s50_1 input4 (.A(a[3]),
    .X(net4));
 sky130_fd_sc_hd__clkdlybuf4s50_1 input5 (.A(a[4]),
    .X(net5));
 sky130_fd_sc_hd__clkdlybuf4s50_1 input6 (.A(a[5]),
    .X(net6));
 sky130_fd_sc_hd__clkdlybuf4s50_1 input7 (.A(a[6]),
    .X(net7));
 sky130_fd_sc_hd__clkdlybuf4s50_1 input8 (.A(a[7]),
    .X(net8));
 sky130_fd_sc_hd__clkdlybuf4s50_1 input9 (.A(b[0]),
    .X(net9));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output20 (.A(net20),
    .X(result[0]));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output21 (.A(net21),
    .X(result[1]));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output22 (.A(net22),
    .X(result[2]));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output23 (.A(net23),
    .X(result[3]));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output24 (.A(net24),
    .X(result[4]));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output25 (.A(net25),
    .X(result[5]));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output26 (.A(net26),
    .X(result[6]));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output27 (.A(net27),
    .X(result[7]));
endmodule
