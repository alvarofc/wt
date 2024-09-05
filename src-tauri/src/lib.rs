
//use std::process::Command;

use tauri_plugin_fs::FsExt;
// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            // allowed the given directory
            let scope = app.fs_scope();
            scope.allow_directory("../tempFiles", true);
            dbg!(scope.allowed());
  
            Ok(())
         })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


