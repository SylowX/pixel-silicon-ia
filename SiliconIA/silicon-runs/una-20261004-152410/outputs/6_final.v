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
 wire _048_;
 wire _050_;
 wire _051_;
 wire _052_;
 wire _053_;
 wire _054_;
 wire _055_;
 wire _056_;
 wire _057_;
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
 wire _072_;
 wire _073_;
 wire _074_;
 wire _075_;
 wire _076_;
 wire _077_;
 wire _078_;
 wire _079_;
 wire _080_;
 wire _081_;
 wire _082_;
 wire _083_;
 wire _084_;
 wire _085_;
 wire _086_;
 wire _087_;
 wire _088_;
 wire _089_;
 wire _090_;
 wire _091_;
 wire _092_;
 wire _093_;
 wire _094_;
 wire _095_;
 wire _096_;
 wire _097_;
 wire _098_;
 wire _099_;
 wire _100_;
 wire _101_;
 wire _102_;
 wire _103_;
 wire _104_;
 wire _105_;
 wire _106_;
 wire _107_;
 wire _108_;
 wire _109_;
 wire _110_;
 wire _111_;
 wire _112_;
 wire _113_;
 wire _114_;
 wire _115_;
 wire _116_;
 wire _117_;
 wire _118_;
 wire _119_;
 wire _120_;
 wire _121_;
 wire _122_;
 wire _123_;
 wire _124_;
 wire _125_;
 wire net1;
 wire net2;
 wire net3;
 wire net4;
 wire net5;
 wire net6;
 wire net7;
 wire net8;
 wire \and_result[0] ;
 wire \and_result[1] ;
 wire \and_result[2] ;
 wire \and_result[3] ;
 wire \and_result[4] ;
 wire \and_result[5] ;
 wire \and_result[6] ;
 wire \and_result[7] ;
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
 wire \xor_result[0] ;
 wire \xor_result[1] ;
 wire \xor_result[2] ;
 wire \xor_result[3] ;
 wire \xor_result[4] ;
 wire \xor_result[5] ;
 wire \xor_result[6] ;
 wire \xor_result[7] ;

 sky130_fd_sc_hd__inv_1 _126_ (.A(net12),
    .Y(_034_));
 sky130_fd_sc_hd__inv_1 _127_ (.A(net11),
    .Y(_037_));
 sky130_fd_sc_hd__inv_1 _128_ (.A(net14),
    .Y(_028_));
 sky130_fd_sc_hd__inv_1 _129_ (.A(net13),
    .Y(_031_));
 sky130_fd_sc_hd__inv_1 _130_ (.A(net2),
    .Y(_039_));
 sky130_fd_sc_hd__inv_1 _131_ (.A(net9),
    .Y(_004_));
 sky130_fd_sc_hd__inv_1 _132_ (.A(net15),
    .Y(_025_));
 sky130_fd_sc_hd__inv_1 _133_ (.A(net5),
    .Y(_030_));
 sky130_fd_sc_hd__inv_1 _134_ (.A(net10),
    .Y(_003_));
 sky130_fd_sc_hd__inv_1 _135_ (.A(net3),
    .Y(_036_));
 sky130_fd_sc_hd__inv_1 _136_ (.A(net4),
    .Y(_033_));
 sky130_fd_sc_hd__inv_1 _137_ (.A(net1),
    .Y(_041_));
 sky130_fd_sc_hd__inv_1 _138_ (.A(_012_),
    .Y(_046_));
 sky130_fd_sc_hd__or2_1 _140_ (.A(net19),
    .B(net18),
    .X(_048_));
 sky130_fd_sc_hd__nor3_1 _142_ (.A(_015_),
    .B(_046_),
    .C(_048_),
    .Y(_050_));
 sky130_fd_sc_hd__nor3b_1 _143_ (.A(_011_),
    .B(_048_),
    .C_N(_015_),
    .Y(_051_));
 sky130_fd_sc_hd__a21o_1 _144_ (.A1(_009_),
    .A2(_001_),
    .B1(_008_),
    .X(_052_));
 sky130_fd_sc_hd__a21o_1 _145_ (.A1(_022_),
    .A2(_052_),
    .B1(_021_),
    .X(_053_));
 sky130_fd_sc_hd__a21oi_1 _146_ (.A1(_019_),
    .A2(_053_),
    .B1(_018_),
    .Y(_054_));
 sky130_fd_sc_hd__mux2i_1 _147_ (.A0(_050_),
    .A1(_051_),
    .S(_054_),
    .Y(_055_));
 sky130_fd_sc_hd__nor3b_1 _148_ (.A(_048_),
    .B(_015_),
    .C_N(_011_),
    .Y(_056_));
 sky130_fd_sc_hd__inv_1 _149_ (.A(net19),
    .Y(_057_));
 sky130_fd_sc_hd__nor3_1 _151_ (.A(_057_),
    .B(net17),
    .C(net18),
    .Y(_059_));
 sky130_fd_sc_hd__nand2_1 _152_ (.A(_057_),
    .B(net18),
    .Y(_060_));
 sky130_fd_sc_hd__nand2_1 _153_ (.A(net17),
    .B(_026_),
    .Y(_061_));
 sky130_fd_sc_hd__o21ai_0 _154_ (.A1(net17),
    .A2(\and_result[6] ),
    .B1(_061_),
    .Y(_062_));
 sky130_fd_sc_hd__o2bb2ai_1 _155_ (.A1_N(\xor_result[6] ),
    .A2_N(_059_),
    .B1(_060_),
    .B2(_062_),
    .Y(_063_));
 sky130_fd_sc_hd__a211oi_1 _156_ (.A1(_046_),
    .A2(_051_),
    .B1(_056_),
    .C1(_063_),
    .Y(_064_));
 sky130_fd_sc_hd__nand2_1 _157_ (.A(_055_),
    .B(_064_),
    .Y(net26));
 sky130_fd_sc_hd__nand3_1 _158_ (.A(_009_),
    .B(_016_),
    .C(\and_result[0] ),
    .Y(_065_));
 sky130_fd_sc_hd__a21oi_1 _159_ (.A1(_009_),
    .A2(_023_),
    .B1(_008_),
    .Y(_066_));
 sky130_fd_sc_hd__nand2_1 _160_ (.A(_065_),
    .B(_066_),
    .Y(_067_));
 sky130_fd_sc_hd__a21o_1 _161_ (.A1(_019_),
    .A2(_021_),
    .B1(_018_),
    .X(_068_));
 sky130_fd_sc_hd__a31oi_1 _162_ (.A1(_019_),
    .A2(_022_),
    .A3(_067_),
    .B1(_068_),
    .Y(_069_));
 sky130_fd_sc_hd__xnor2_1 _163_ (.A(_046_),
    .B(_069_),
    .Y(_070_));
 sky130_fd_sc_hd__nor2_1 _165_ (.A(net17),
    .B(net18),
    .Y(_072_));
 sky130_fd_sc_hd__nor2_1 _166_ (.A(net17),
    .B(\and_result[5] ),
    .Y(_073_));
 sky130_fd_sc_hd__a211oi_1 _167_ (.A1(net17),
    .A2(_029_),
    .B1(_060_),
    .C1(_073_),
    .Y(_074_));
 sky130_fd_sc_hd__a31oi_1 _168_ (.A1(net19),
    .A2(\xor_result[5] ),
    .A3(_072_),
    .B1(_074_),
    .Y(_075_));
 sky130_fd_sc_hd__o21ai_0 _169_ (.A1(_048_),
    .A2(_070_),
    .B1(_075_),
    .Y(net25));
 sky130_fd_sc_hd__inv_1 _170_ (.A(_032_),
    .Y(_076_));
 sky130_fd_sc_hd__mux2i_1 _171_ (.A0(\and_result[4] ),
    .A1(_076_),
    .S(net17),
    .Y(_077_));
 sky130_fd_sc_hd__xnor2_1 _172_ (.A(_019_),
    .B(_053_),
    .Y(_078_));
 sky130_fd_sc_hd__nand2_1 _173_ (.A(\xor_result[4] ),
    .B(_059_),
    .Y(_079_));
 sky130_fd_sc_hd__o221ai_1 _174_ (.A1(_060_),
    .A2(_077_),
    .B1(_078_),
    .B2(_048_),
    .C1(_079_),
    .Y(net24));
 sky130_fd_sc_hd__inv_1 _175_ (.A(_035_),
    .Y(_080_));
 sky130_fd_sc_hd__mux2i_1 _176_ (.A0(\and_result[3] ),
    .A1(_080_),
    .S(net17),
    .Y(_081_));
 sky130_fd_sc_hd__xnor2_1 _177_ (.A(_022_),
    .B(_067_),
    .Y(_082_));
 sky130_fd_sc_hd__nand2_1 _178_ (.A(\xor_result[3] ),
    .B(_059_),
    .Y(_083_));
 sky130_fd_sc_hd__o221ai_1 _179_ (.A1(_060_),
    .A2(_081_),
    .B1(_082_),
    .B2(_048_),
    .C1(_083_),
    .Y(net23));
 sky130_fd_sc_hd__xor2_1 _180_ (.A(_009_),
    .B(_001_),
    .X(_084_));
 sky130_fd_sc_hd__inv_1 _181_ (.A(\xor_result[2] ),
    .Y(_085_));
 sky130_fd_sc_hd__o21ai_0 _182_ (.A1(net17),
    .A2(_085_),
    .B1(net19),
    .Y(_086_));
 sky130_fd_sc_hd__o21ai_0 _183_ (.A1(net19),
    .A2(_084_),
    .B1(_086_),
    .Y(_087_));
 sky130_fd_sc_hd__inv_1 _184_ (.A(_038_),
    .Y(_088_));
 sky130_fd_sc_hd__mux2i_1 _185_ (.A0(\and_result[2] ),
    .A1(_088_),
    .S(net17),
    .Y(_089_));
 sky130_fd_sc_hd__o22ai_1 _186_ (.A1(net18),
    .A2(_087_),
    .B1(_089_),
    .B2(_060_),
    .Y(net22));
 sky130_fd_sc_hd__nor2_1 _187_ (.A(net17),
    .B(\and_result[1] ),
    .Y(_090_));
 sky130_fd_sc_hd__a21oi_1 _188_ (.A1(net17),
    .A2(_040_),
    .B1(_090_),
    .Y(_091_));
 sky130_fd_sc_hd__mux2i_1 _189_ (.A0(_002_),
    .A1(_091_),
    .S(net18),
    .Y(_092_));
 sky130_fd_sc_hd__a21oi_1 _190_ (.A1(\xor_result[1] ),
    .A2(_072_),
    .B1(_057_),
    .Y(_093_));
 sky130_fd_sc_hd__a21oi_1 _191_ (.A1(_057_),
    .A2(_092_),
    .B1(_093_),
    .Y(net21));
 sky130_fd_sc_hd__inv_1 _192_ (.A(_042_),
    .Y(_094_));
 sky130_fd_sc_hd__nor2b_1 _193_ (.A(net18),
    .B_N(\xor_result[0] ),
    .Y(_095_));
 sky130_fd_sc_hd__a31oi_1 _194_ (.A1(net17),
    .A2(net18),
    .A3(_094_),
    .B1(_095_),
    .Y(_096_));
 sky130_fd_sc_hd__a31oi_1 _195_ (.A1(\and_result[0] ),
    .A2(_057_),
    .A3(net18),
    .B1(_095_),
    .Y(_097_));
 sky130_fd_sc_hd__o22ai_1 _196_ (.A1(net19),
    .A2(_096_),
    .B1(_097_),
    .B2(net17),
    .Y(net20));
 sky130_fd_sc_hd__inv_1 _197_ (.A(net8),
    .Y(_043_));
 sky130_fd_sc_hd__inv_1 _198_ (.A(net16),
    .Y(_044_));
 sky130_fd_sc_hd__inv_1 _199_ (.A(net7),
    .Y(_024_));
 sky130_fd_sc_hd__and3_1 _200_ (.A(_005_),
    .B(_037_),
    .C(_034_),
    .X(_098_));
 sky130_fd_sc_hd__nor2_1 _201_ (.A(net13),
    .B(net14),
    .Y(_099_));
 sky130_fd_sc_hd__nor3_4 _202_ (.A(net19),
    .B(net17),
    .C(net18),
    .Y(_100_));
 sky130_fd_sc_hd__a21oi_1 _203_ (.A1(_098_),
    .A2(_099_),
    .B1(_100_),
    .Y(_101_));
 sky130_fd_sc_hd__xnor2_1 _204_ (.A(_025_),
    .B(_101_),
    .Y(_013_));
 sky130_fd_sc_hd__nor3_2 _205_ (.A(net11),
    .B(net10),
    .C(net9),
    .Y(_102_));
 sky130_fd_sc_hd__a31oi_1 _206_ (.A1(_031_),
    .A2(_034_),
    .A3(_102_),
    .B1(_100_),
    .Y(_103_));
 sky130_fd_sc_hd__xnor2_1 _207_ (.A(_028_),
    .B(_103_),
    .Y(_010_));
 sky130_fd_sc_hd__nor2_1 _208_ (.A(_100_),
    .B(_098_),
    .Y(_104_));
 sky130_fd_sc_hd__xnor2_1 _209_ (.A(_031_),
    .B(_104_),
    .Y(_017_));
 sky130_fd_sc_hd__nor2_1 _210_ (.A(_100_),
    .B(_102_),
    .Y(_105_));
 sky130_fd_sc_hd__xnor2_1 _211_ (.A(_034_),
    .B(_105_),
    .Y(_020_));
 sky130_fd_sc_hd__nor2_1 _212_ (.A(_005_),
    .B(_100_),
    .Y(_106_));
 sky130_fd_sc_hd__xnor2_1 _213_ (.A(_037_),
    .B(_106_),
    .Y(_007_));
 sky130_fd_sc_hd__mux2_2 _214_ (.A0(_006_),
    .A1(net10),
    .S(_100_),
    .X(_000_));
 sky130_fd_sc_hd__a41oi_2 _215_ (.A1(_025_),
    .A2(_034_),
    .A3(_099_),
    .A4(_102_),
    .B1(_100_),
    .Y(_107_));
 sky130_fd_sc_hd__xor2_1 _216_ (.A(net8),
    .B(net16),
    .X(_108_));
 sky130_fd_sc_hd__xnor2_1 _217_ (.A(_107_),
    .B(_108_),
    .Y(_109_));
 sky130_fd_sc_hd__and4_1 _218_ (.A(_015_),
    .B(_012_),
    .C(_019_),
    .D(_022_),
    .X(_110_));
 sky130_fd_sc_hd__a21o_1 _219_ (.A1(_015_),
    .A2(_011_),
    .B1(_014_),
    .X(_111_));
 sky130_fd_sc_hd__a31o_2 _220_ (.A1(_015_),
    .A2(_012_),
    .A3(_068_),
    .B1(_111_),
    .X(_112_));
 sky130_fd_sc_hd__a21oi_1 _221_ (.A1(_067_),
    .A2(_110_),
    .B1(_112_),
    .Y(_113_));
 sky130_fd_sc_hd__xnor2_1 _222_ (.A(_109_),
    .B(_113_),
    .Y(_114_));
 sky130_fd_sc_hd__nor2_1 _223_ (.A(net17),
    .B(\and_result[7] ),
    .Y(_115_));
 sky130_fd_sc_hd__a211oi_1 _224_ (.A1(net17),
    .A2(_045_),
    .B1(_060_),
    .C1(_115_),
    .Y(_116_));
 sky130_fd_sc_hd__a21oi_1 _225_ (.A1(\xor_result[7] ),
    .A2(_059_),
    .B1(_116_),
    .Y(_117_));
 sky130_fd_sc_hd__o21ai_1 _226_ (.A1(_048_),
    .A2(_114_),
    .B1(_117_),
    .Y(net27));
 sky130_fd_sc_hd__inv_1 _227_ (.A(net6),
    .Y(_027_));
 sky130_fd_sc_hd__fa_1 _228_ (.A(net2),
    .B(\and_result[0] ),
    .CIN(_000_),
    .COUT(_001_),
    .SUM(_002_));
 sky130_fd_sc_hd__ha_1 _229_ (.A(_003_),
    .B(_004_),
    .COUT(_005_),
    .SUM(_006_));
 sky130_fd_sc_hd__ha_1 _230_ (.A(net3),
    .B(_007_),
    .COUT(_008_),
    .SUM(_009_));
 sky130_fd_sc_hd__ha_1 _231_ (.A(net6),
    .B(_010_),
    .COUT(_011_),
    .SUM(_012_));
 sky130_fd_sc_hd__ha_1 _232_ (.A(net7),
    .B(_013_),
    .COUT(_014_),
    .SUM(_015_));
 sky130_fd_sc_hd__ha_1 _233_ (.A(net5),
    .B(_017_),
    .COUT(_018_),
    .SUM(_019_));
 sky130_fd_sc_hd__ha_1 _234_ (.A(net4),
    .B(_020_),
    .COUT(_021_),
    .SUM(_022_));
 sky130_fd_sc_hd__ha_1 _235_ (.A(net2),
    .B(_000_),
    .COUT(_023_),
    .SUM(_016_));
 sky130_fd_sc_hd__ha_1 _236_ (.A(_024_),
    .B(_025_),
    .COUT(_026_),
    .SUM(\xor_result[6] ));
 sky130_fd_sc_hd__ha_1 _237_ (.A(net7),
    .B(net15),
    .COUT(\and_result[6] ),
    .SUM(_118_));
 sky130_fd_sc_hd__ha_1 _238_ (.A(_027_),
    .B(_028_),
    .COUT(_029_),
    .SUM(\xor_result[5] ));
 sky130_fd_sc_hd__ha_1 _239_ (.A(net6),
    .B(net14),
    .COUT(\and_result[5] ),
    .SUM(_119_));
 sky130_fd_sc_hd__ha_1 _240_ (.A(_030_),
    .B(_031_),
    .COUT(_032_),
    .SUM(\xor_result[4] ));
 sky130_fd_sc_hd__ha_1 _241_ (.A(net5),
    .B(net13),
    .COUT(\and_result[4] ),
    .SUM(_120_));
 sky130_fd_sc_hd__ha_1 _242_ (.A(_033_),
    .B(_034_),
    .COUT(_035_),
    .SUM(\xor_result[3] ));
 sky130_fd_sc_hd__ha_1 _243_ (.A(net4),
    .B(net12),
    .COUT(\and_result[3] ),
    .SUM(_121_));
 sky130_fd_sc_hd__ha_1 _244_ (.A(_036_),
    .B(_037_),
    .COUT(_038_),
    .SUM(\xor_result[2] ));
 sky130_fd_sc_hd__ha_1 _245_ (.A(net3),
    .B(net11),
    .COUT(\and_result[2] ),
    .SUM(_122_));
 sky130_fd_sc_hd__ha_1 _246_ (.A(_039_),
    .B(_003_),
    .COUT(_040_),
    .SUM(\xor_result[1] ));
 sky130_fd_sc_hd__ha_1 _247_ (.A(net2),
    .B(net10),
    .COUT(\and_result[1] ),
    .SUM(_123_));
 sky130_fd_sc_hd__ha_1 _248_ (.A(_041_),
    .B(_004_),
    .COUT(_042_),
    .SUM(\xor_result[0] ));
 sky130_fd_sc_hd__ha_1 _249_ (.A(net1),
    .B(net9),
    .COUT(\and_result[0] ),
    .SUM(_124_));
 sky130_fd_sc_hd__ha_1 _250_ (.A(_043_),
    .B(_044_),
    .COUT(_045_),
    .SUM(\xor_result[7] ));
 sky130_fd_sc_hd__ha_1 _251_ (.A(net8),
    .B(net16),
    .COUT(\and_result[7] ),
    .SUM(_125_));
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
