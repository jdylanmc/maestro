local wezterm = require("wezterm")

local config = wezterm.config_builder()
local home = os.getenv("HOME")

config.color_scheme = "nord"
config.font_size = 15.0
config.window_background_opacity = 0.95
config.macos_window_background_blur = 20
config.default_prog = { home .. "/.local/bin/maestro-herdr" }
config.enable_kitty_keyboard = true
config.window_decorations = "INTEGRATED_BUTTONS|RESIZE"
config.enable_tab_bar = true
config.use_fancy_tab_bar = true
config.show_tabs_in_tab_bar = false
config.show_new_tab_button_in_tab_bar = false
config.integrated_title_button_style = "MacOsNative"
config.integrated_title_button_alignment = "Left"
config.window_frame = {
  active_titlebar_bg = "#2e3440",
  inactive_titlebar_bg = "#2e3440",
  button_bg = "#2e3440",
  button_hover_bg = "#3b4252",
}

return config
