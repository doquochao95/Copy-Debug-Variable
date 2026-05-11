# Copy Debug Variable 🚀

A powerful VS Code extension that allows you to copy and compare debugger variables quickly, accurately, and without element limits.

## Why use this extension?

By default, when copying large arrays or objects in the VS Code Debugger, you often face:
- **Truncation**: Only the first 25-50 elements are copied.
- **Slow Performance**: Significant lag when traversing deeply nested objects.
- **Formatting Issues**: Loss of Unicode characters or decimal precision.

**Copy Debug Variable** solves these problems using a **Turbo Strategy (JSON Serialization)**.

## Key Features

- ⚡ **Turbo Speed**: Uses native language serialization to package data, allowing you to fetch 10,000+ elements in the blink of an eye.
- 🌐 **Multi-Language Support**: Works perfectly on both **.NET (C#)** and **JavaScript/TypeScript** (Node.js, React, Chrome, etc.).
- 💎 **Original Data Integrity**: Preserves decimal formatting (e.g., `2.0`), supports Unicode (Vietnamese, Chinese, etc.), and handles special types.
- 🛠 **Smart Handling**: Automatically manages circular references to prevent debugger crashes.
- 📋 **Flexible Formats**: Supports copying as **JSON** or **Plain Text**.
- 🔍 **Smart Comparison (Diff View)**: Compare two variables or two different states of the same variable using VS Code's native diff editor.

### Format Details:

*   **JSON Format (Default)**:
    *   Reconstructs objects into valid JSON strings.
    *   Pretty-printed with indentation for readability.
    *   **Best for**: Saving to `.json` files, creating mock data for APIs, or data analysis tools.
    *   Preserves data types (numbers, booleans, arrays, nested objects).

*   **Plain Text Format**:
    *   Removes JSON syntax (brackets, commas) to keep only the core content.
    *   Uses indentation to represent the object hierarchy.
    *   **Best for**: Documentation, sharing in chat (Slack/Teams/Discord) for quick review, or when you want to avoid JSON syntax noise.

## How to Use

### Basic Copying
1. While debugging, right-click on any variable in the **Variables** view.
2. Select **Copy Variable Value**.
3. The data is now ready in your clipboard!

### Smart Comparison
1. Right-click on **Variable A** and select **Select for Compare**.
2. Right-click on **Variable B** and select **Compare with Selected**.
3. VS Code will open a side-by-side diff view showing the structural differences.

## Requirements

- **For .NET (C#)**: Your project needs `Newtonsoft.Json` (most common) or `System.Text.Json` (default in .NET Core 3+).
- **For JavaScript/TypeScript**: No extra requirements, works out of the box.

## Configuration

You can customize the default format in Settings:
- `copyDebugVariable.format`: `json` (default) or `plain`.

---
**Developed by Hao Do.** Happy Debugging! 💻✨