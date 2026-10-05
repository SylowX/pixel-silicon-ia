module counter16 (clk,
    enable,
    rst_n,
    count);
 input clk;
 input enable;
 input rst_n;
 output [15:0] count;

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
 wire _029_;
 wire _030_;
 wire _031_;
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
 wire \count_increment_ext[1] ;
 wire net1;
 wire net2;
 wire clknet_0_clk;
 wire clknet_1_0__leaf_clk;
 wire clknet_1_1__leaf_clk;

 sky130_fd_sc_hd__inv_1 _062_ (.A(net7),
    .Y(_017_));
 sky130_fd_sc_hd__and4_4 _063_ (.A(net15),
    .B(net16),
    .C(net17),
    .D(net18),
    .X(_018_));
 sky130_fd_sc_hd__nand4_4 _064_ (.A(net4),
    .B(net5),
    .C(net6),
    .D(_018_),
    .Y(_019_));
 sky130_fd_sc_hd__nand2_1 _065_ (.A(_000_),
    .B(net1),
    .Y(_020_));
 sky130_fd_sc_hd__nand4_1 _066_ (.A(net11),
    .B(net12),
    .C(net13),
    .D(net14),
    .Y(_021_));
 sky130_fd_sc_hd__o41ai_1 _067_ (.A1(_017_),
    .A2(_019_),
    .A3(_020_),
    .A4(_021_),
    .B1(net8),
    .Y(_022_));
 sky130_fd_sc_hd__nor2_1 _068_ (.A(_020_),
    .B(_021_),
    .Y(_023_));
 sky130_fd_sc_hd__or4b_1 _069_ (.A(_017_),
    .B(net8),
    .C(_019_),
    .D_N(_023_),
    .X(_024_));
 sky130_fd_sc_hd__inv_1 _070_ (.A(net2),
    .Y(_025_));
 sky130_fd_sc_hd__a21oi_1 _071_ (.A1(_022_),
    .A2(_024_),
    .B1(_025_),
    .Y(_001_));
 sky130_fd_sc_hd__and4_1 _072_ (.A(net11),
    .B(net12),
    .C(net13),
    .D(net14),
    .X(_026_));
 sky130_fd_sc_hd__and4_1 _073_ (.A(net3),
    .B(net10),
    .C(net2),
    .D(net1),
    .X(_027_));
 sky130_fd_sc_hd__nand2_2 _075_ (.A(_026_),
    .B(_027_),
    .Y(_029_));
 sky130_fd_sc_hd__o21ai_0 _076_ (.A1(_019_),
    .A2(_029_),
    .B1(net7),
    .Y(_030_));
 sky130_fd_sc_hd__or3_1 _077_ (.A(net7),
    .B(_019_),
    .C(_029_),
    .X(_031_));
 sky130_fd_sc_hd__a21oi_1 _078_ (.A1(_030_),
    .A2(_031_),
    .B1(_025_),
    .Y(_002_));
 sky130_fd_sc_hd__nand4_1 _080_ (.A(net15),
    .B(net16),
    .C(net17),
    .D(net18),
    .Y(_033_));
 sky130_fd_sc_hd__nand2_1 _081_ (.A(net4),
    .B(net5),
    .Y(_034_));
 sky130_fd_sc_hd__nor4_1 _082_ (.A(_033_),
    .B(_034_),
    .C(_020_),
    .D(_021_),
    .Y(_035_));
 sky130_fd_sc_hd__xnor2_1 _083_ (.A(net6),
    .B(_035_),
    .Y(_036_));
 sky130_fd_sc_hd__nor2_1 _084_ (.A(_025_),
    .B(_036_),
    .Y(_003_));
 sky130_fd_sc_hd__nand4_1 _085_ (.A(net4),
    .B(_018_),
    .C(_026_),
    .D(_027_),
    .Y(_037_));
 sky130_fd_sc_hd__xor2_1 _086_ (.A(net5),
    .B(_037_),
    .X(_038_));
 sky130_fd_sc_hd__nor2_1 _087_ (.A(_025_),
    .B(_038_),
    .Y(_004_));
 sky130_fd_sc_hd__nor3_1 _088_ (.A(_033_),
    .B(_020_),
    .C(_021_),
    .Y(_039_));
 sky130_fd_sc_hd__xnor2_1 _089_ (.A(net4),
    .B(_039_),
    .Y(_040_));
 sky130_fd_sc_hd__nor2_1 _090_ (.A(_025_),
    .B(_040_),
    .Y(_005_));
 sky130_fd_sc_hd__and3_2 _091_ (.A(net15),
    .B(net16),
    .C(net17),
    .X(_041_));
 sky130_fd_sc_hd__nand3_1 _092_ (.A(_041_),
    .B(_026_),
    .C(_027_),
    .Y(_042_));
 sky130_fd_sc_hd__xor2_1 _093_ (.A(net18),
    .B(_042_),
    .X(_043_));
 sky130_fd_sc_hd__nor2_1 _094_ (.A(_025_),
    .B(_043_),
    .Y(_006_));
 sky130_fd_sc_hd__nand2_1 _095_ (.A(net15),
    .B(net16),
    .Y(_044_));
 sky130_fd_sc_hd__nor3_1 _096_ (.A(_044_),
    .B(_020_),
    .C(_021_),
    .Y(_045_));
 sky130_fd_sc_hd__xnor2_1 _097_ (.A(net17),
    .B(_045_),
    .Y(_046_));
 sky130_fd_sc_hd__nor2_1 _098_ (.A(_025_),
    .B(_046_),
    .Y(_007_));
 sky130_fd_sc_hd__nand3_1 _099_ (.A(net15),
    .B(_026_),
    .C(_027_),
    .Y(_047_));
 sky130_fd_sc_hd__xor2_1 _100_ (.A(net16),
    .B(_047_),
    .X(_048_));
 sky130_fd_sc_hd__nor2_1 _101_ (.A(_025_),
    .B(_048_),
    .Y(_008_));
 sky130_fd_sc_hd__xnor2_1 _102_ (.A(net15),
    .B(_023_),
    .Y(_049_));
 sky130_fd_sc_hd__nor2_1 _103_ (.A(_025_),
    .B(_049_),
    .Y(_009_));
 sky130_fd_sc_hd__nand4_1 _104_ (.A(net11),
    .B(net12),
    .C(net13),
    .D(_027_),
    .Y(_050_));
 sky130_fd_sc_hd__xor2_1 _105_ (.A(net14),
    .B(_050_),
    .X(_051_));
 sky130_fd_sc_hd__nor2_1 _106_ (.A(_025_),
    .B(_051_),
    .Y(_010_));
 sky130_fd_sc_hd__nand4_1 _107_ (.A(net11),
    .B(net12),
    .C(_000_),
    .D(net1),
    .Y(_052_));
 sky130_fd_sc_hd__xor2_1 _108_ (.A(net13),
    .B(_052_),
    .X(_053_));
 sky130_fd_sc_hd__nor2_1 _109_ (.A(_025_),
    .B(_053_),
    .Y(_011_));
 sky130_fd_sc_hd__nand2_1 _110_ (.A(net11),
    .B(_027_),
    .Y(_054_));
 sky130_fd_sc_hd__xor2_1 _111_ (.A(net12),
    .B(_054_),
    .X(_055_));
 sky130_fd_sc_hd__nor2_1 _112_ (.A(_025_),
    .B(_055_),
    .Y(_012_));
 sky130_fd_sc_hd__xor2_1 _113_ (.A(net11),
    .B(_020_),
    .X(_056_));
 sky130_fd_sc_hd__nor2_1 _114_ (.A(_025_),
    .B(_056_),
    .Y(_013_));
 sky130_fd_sc_hd__mux2i_1 _115_ (.A0(net10),
    .A1(\count_increment_ext[1] ),
    .S(net1),
    .Y(_057_));
 sky130_fd_sc_hd__nor2_1 _116_ (.A(_025_),
    .B(_057_),
    .Y(_014_));
 sky130_fd_sc_hd__xnor2_1 _117_ (.A(net3),
    .B(net1),
    .Y(_058_));
 sky130_fd_sc_hd__nor2_1 _118_ (.A(_025_),
    .B(_058_),
    .Y(_015_));
 sky130_fd_sc_hd__nand2_1 _119_ (.A(net7),
    .B(net8),
    .Y(_059_));
 sky130_fd_sc_hd__o31ai_1 _120_ (.A1(_019_),
    .A2(_029_),
    .A3(_059_),
    .B1(net9),
    .Y(_060_));
 sky130_fd_sc_hd__or4_1 _121_ (.A(net9),
    .B(_019_),
    .C(_029_),
    .D(_059_),
    .X(_061_));
 sky130_fd_sc_hd__a21oi_1 _122_ (.A1(_060_),
    .A2(_061_),
    .B1(_025_),
    .Y(_016_));
 sky130_fd_sc_hd__ha_1 _123_ (.A(net3),
    .B(net10),
    .COUT(_000_),
    .SUM(\count_increment_ext[1] ));
 sky130_fd_sc_hd__clkbuf_4 clkbuf_0_clk (.A(clk),
    .X(clknet_0_clk));
 sky130_fd_sc_hd__clkbuf_4 clkbuf_1_0__f_clk (.A(clknet_0_clk),
    .X(clknet_1_0__leaf_clk));
 sky130_fd_sc_hd__clkbuf_4 clkbuf_1_1__f_clk (.A(clknet_0_clk),
    .X(clknet_1_1__leaf_clk));
 sky130_fd_sc_hd__clkbuf_8 clkload0 (.A(clknet_1_0__leaf_clk));
 sky130_fd_sc_hd__dfxtp_1 \count_q[0]$_SDFFE_PN0P_  (.D(_015_),
    .Q(net3),
    .CLK(clknet_1_0__leaf_clk));
 sky130_fd_sc_hd__dfxtp_1 \count_q[10]$_SDFFE_PN0P_  (.D(_005_),
    .Q(net4),
    .CLK(clknet_1_1__leaf_clk));
 sky130_fd_sc_hd__dfxtp_1 \count_q[11]$_SDFFE_PN0P_  (.D(_004_),
    .Q(net5),
    .CLK(clknet_1_0__leaf_clk));
 sky130_fd_sc_hd__dfxtp_1 \count_q[12]$_SDFFE_PN0P_  (.D(_003_),
    .Q(net6),
    .CLK(clknet_1_0__leaf_clk));
 sky130_fd_sc_hd__dfxtp_1 \count_q[13]$_SDFFE_PN0P_  (.D(_002_),
    .Q(net7),
    .CLK(clknet_1_0__leaf_clk));
 sky130_fd_sc_hd__dfxtp_1 \count_q[14]$_SDFFE_PN0P_  (.D(_001_),
    .Q(net8),
    .CLK(clknet_1_0__leaf_clk));
 sky130_fd_sc_hd__dfxtp_1 \count_q[15]$_SDFFE_PN0P_  (.D(_016_),
    .Q(net9),
    .CLK(clknet_1_0__leaf_clk));
 sky130_fd_sc_hd__dfxtp_1 \count_q[1]$_SDFFE_PN0P_  (.D(_014_),
    .Q(net10),
    .CLK(clknet_1_0__leaf_clk));
 sky130_fd_sc_hd__dfxtp_1 \count_q[2]$_SDFFE_PN0P_  (.D(_013_),
    .Q(net11),
    .CLK(clknet_1_1__leaf_clk));
 sky130_fd_sc_hd__dfxtp_1 \count_q[3]$_SDFFE_PN0P_  (.D(_012_),
    .Q(net12),
    .CLK(clknet_1_1__leaf_clk));
 sky130_fd_sc_hd__dfxtp_1 \count_q[4]$_SDFFE_PN0P_  (.D(_011_),
    .Q(net13),
    .CLK(clknet_1_1__leaf_clk));
 sky130_fd_sc_hd__dfxtp_1 \count_q[5]$_SDFFE_PN0P_  (.D(_010_),
    .Q(net14),
    .CLK(clknet_1_1__leaf_clk));
 sky130_fd_sc_hd__dfxtp_1 \count_q[6]$_SDFFE_PN0P_  (.D(_009_),
    .Q(net15),
    .CLK(clknet_1_1__leaf_clk));
 sky130_fd_sc_hd__dfxtp_1 \count_q[7]$_SDFFE_PN0P_  (.D(_008_),
    .Q(net16),
    .CLK(clknet_1_1__leaf_clk));
 sky130_fd_sc_hd__dfxtp_1 \count_q[8]$_SDFFE_PN0P_  (.D(_007_),
    .Q(net17),
    .CLK(clknet_1_1__leaf_clk));
 sky130_fd_sc_hd__dfxtp_1 \count_q[9]$_SDFFE_PN0P_  (.D(_006_),
    .Q(net18),
    .CLK(clknet_1_1__leaf_clk));
 sky130_fd_sc_hd__clkdlybuf4s50_1 input1 (.A(enable),
    .X(net1));
 sky130_fd_sc_hd__clkdlybuf4s50_1 input2 (.A(rst_n),
    .X(net2));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output10 (.A(net10),
    .X(count[1]));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output11 (.A(net11),
    .X(count[2]));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output12 (.A(net12),
    .X(count[3]));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output13 (.A(net13),
    .X(count[4]));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output14 (.A(net14),
    .X(count[5]));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output15 (.A(net15),
    .X(count[6]));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output16 (.A(net16),
    .X(count[7]));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output17 (.A(net17),
    .X(count[8]));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output18 (.A(net18),
    .X(count[9]));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output3 (.A(net3),
    .X(count[0]));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output4 (.A(net4),
    .X(count[10]));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output5 (.A(net5),
    .X(count[11]));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output6 (.A(net6),
    .X(count[12]));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output7 (.A(net7),
    .X(count[13]));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output8 (.A(net8),
    .X(count[14]));
 sky130_fd_sc_hd__clkdlybuf4s50_1 output9 (.A(net9),
    .X(count[15]));
endmodule
