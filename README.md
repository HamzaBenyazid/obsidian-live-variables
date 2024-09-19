# Obsidian Live Variables Plugin

The Live Variables Plugin for Obsidian allows you to manage and reuse data across your notes by defining variables in the note’s properties. When a variable is updated, all instances of that variable in your note are automatically synchronized, ensuring consistency and saving time when dealing with frequently changing information.

## Features
- **Dynamic Variable Management**: Easily define and update variables within your note’s properties. Any change to a variable will automatically reflect throughout the note.
- **Cross-Note Variable Reuse**: Access and reuse variables from other notes within your vault.
- **Seamless Integration**: Fully integrated into Obsidian, enhancing your workflow without disrupting your note-taking experience.
- **Efficiency Boost**: Reduce manual updates for repetitive information across notes.
- **User-Friendly Interface**: Intuitive setup and management of variables with minimal effort.

## Getting Started

1. **Install the Plugin**:
   - Install directly from the Obsidian plugin marketplace, or manually download the latest release, unzip it, and place the folder in your vault's plugin directory. Enable the plugin in Obsidian’s settings.

2. **Define Variables**:
   - Open the note where you want to use variables.
   - In the note’s frontmatter (the YAML block), define your variables. Example:
     ```yaml
     ---
     projectName: Obsidian Live Variables Plugin
     dueDate: 2024-12-31
     ---
     ```

3. **Insert Variables**:
   You can insert variables using the following options:
   - **Local Variables**: Insert a variable defined within the current note by using the command: `Live Variable: Insert local variable`.
   - **Vault-Wide Variables**: Insert a variable defined in any note within the vault by using the command: `Live Variable: Insert variable from another note`.

4. **Update Variables**:
   - Modify the value of a variable in the note’s properties, and all references to that variable across your vault will be updated instantly.

## Demo
Check out the plugin in action with this demo:

![Demo](demo/demo.gif)

## Contributing
We welcome contributions! If you have suggestions for improvements or new features, feel free to open an issue or submit a pull request.

## License
This project is licensed under the MIT License.
