import subprocess
import tkinter as tk
from tkinter import messagebox

backend_dir = r"C:\Users\Amin\.gemini\antigravity\scratch\accountsd-v4\backend"
frontend_dir = r"C:\Users\Amin\.gemini\antigravity\scratch\accountsd-v4\frontend"

backend_process = None
frontend_process = None


def kill_process_tree(proc):
    if proc and proc.poll() is None:
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )


def start_servers():
    global backend_process, frontend_process

    if backend_process or frontend_process:
        return

    try:
        backend_process = subprocess.Popen(
            ["cmd", "/c", "npm start"],
            cwd=backend_dir,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
        )

        frontend_process = subprocess.Popen(
            ["cmd", "/c", "npm run dev"],
            cwd=frontend_dir,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
        )

        status_label.config(text="Status: Running", fg="green")

    except Exception as e:
        messagebox.showerror("Error", str(e))


def stop_servers():
    global backend_process, frontend_process

    kill_process_tree(backend_process)
    kill_process_tree(frontend_process)

    backend_process = None
    frontend_process = None

    status_label.config(text="Status: Stopped", fg="red")


def restart_servers(event=None):
    status_label.config(text="Status: Restarting...", fg="orange")
    stop_servers()
    root.after(1000, start_servers)  # wait for ports to free


# ---------- GUI ----------
root = tk.Tk()
root.title("Node Server Manager")
root.geometry("320x250")
root.resizable(False, False)

title_label = tk.Label(root, text="Node Server Manager", font=("Arial", 14, "bold"))
title_label.pack(pady=10)

status_label = tk.Label(root, text="Status: Stopped", fg="red", font=("Arial", 10))
status_label.pack(pady=5)

tk.Button(root, text="Start Servers", width=24, bg="green", fg="white", command=start_servers).pack(pady=5)
tk.Button(root, text="Stop Servers", width=24, bg="red", fg="white", command=stop_servers).pack(pady=5)
tk.Button(root, text="Restart Servers (Ctrl+1)", width=24, bg="orange", command=restart_servers).pack(pady=5)

# Shortcut
root.bind("<Control-1>", restart_servers)

root.mainloop()
