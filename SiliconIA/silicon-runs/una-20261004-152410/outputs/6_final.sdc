###############################################################################
# Created by write_sdc
###############################################################################
current_design alu8
###############################################################################
# Timing Constraints
###############################################################################
create_clock -name clk -period 20.0000 
set_input_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {a[0]}]
set_input_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {a[1]}]
set_input_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {a[2]}]
set_input_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {a[3]}]
set_input_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {a[4]}]
set_input_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {a[5]}]
set_input_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {a[6]}]
set_input_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {a[7]}]
set_input_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {b[0]}]
set_input_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {b[1]}]
set_input_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {b[2]}]
set_input_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {b[3]}]
set_input_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {b[4]}]
set_input_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {b[5]}]
set_input_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {b[6]}]
set_input_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {b[7]}]
set_input_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {op[0]}]
set_input_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {op[1]}]
set_input_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {op[2]}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {result[0]}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {result[1]}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {result[2]}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {result[3]}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {result[4]}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {result[5]}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {result[6]}]
set_output_delay 4.0000 -clock [get_clocks {clk}] -add_delay [get_ports {result[7]}]
###############################################################################
# Environment
###############################################################################
###############################################################################
# Design Rules
###############################################################################
