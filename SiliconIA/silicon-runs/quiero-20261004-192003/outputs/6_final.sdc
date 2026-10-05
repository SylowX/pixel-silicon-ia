###############################################################################
# Created by write_sdc
###############################################################################
current_design counter16
###############################################################################
# Timing Constraints
###############################################################################
create_clock -name clk -period 20.0000 [get_ports {clk}]
set_propagated_clock [get_clocks {clk}]
set_input_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {enable}]
set_input_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {rst_n}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {count[0]}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {count[10]}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {count[11]}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {count[12]}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {count[13]}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {count[14]}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {count[15]}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {count[1]}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {count[2]}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {count[3]}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {count[4]}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {count[5]}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {count[6]}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {count[7]}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {count[8]}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {count[9]}]
###############################################################################
# Environment
###############################################################################
###############################################################################
# Design Rules
###############################################################################
