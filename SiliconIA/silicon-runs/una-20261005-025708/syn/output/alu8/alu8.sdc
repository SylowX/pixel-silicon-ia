create_clock -name vclk -period 20.0
set_input_delay -clock vclk 4.0 [all_inputs]
set_output_delay -clock vclk 4.0 [all_outputs]
if {[llength [get_ports -quiet rst_n]] > 0} { set_false_path -from [get_ports rst_n] }
