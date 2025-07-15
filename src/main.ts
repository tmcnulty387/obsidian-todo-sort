import { Editor, MarkdownView, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, Settings, SettingsTab } from "./settings";
import { sortTodos } from "./sort";

export default class MyPlugin extends Plugin {
  settings: Settings;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new SettingsTab(this.app, this));
    this.registerEvent(
      this.app.workspace.on("editor-change", this._onEditorChange)
    );
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  _previousEditorValue = "";
  _onEditorChange = (editor: Editor, _markdownView: MarkdownView) => {
    const newValue = editor.getValue();
    const oldValue = this._previousEditorValue;
    this._previousEditorValue = newValue;

    if (!oldValue) {
      return;
    }

    const newLines = newValue.split("\n");
    const oldLines = oldValue.split("\n");
    if (newLines.length !== oldLines.length) {
      return;
    }

    let changedLineIndex = -1;
    for (let i = 0; i < newLines.length; i++) {
      if (newLines[i] !== oldLines[i]) {
        if (changedLineIndex !== -1) {
          return; // More than one line changed
        }
        changedLineIndex = i;
      }
    }

    if (changedLineIndex === -1) {
      return; // No change
    }

    const newLine = newLines[changedLineIndex];
    const oldLine = oldLines[changedLineIndex];

    const todoRegex = /^(\s*- \[)(.)(\]\s*.*)$/;
    const newLineMatch = newLine.match(todoRegex);
    const oldLineMatch = oldLine.match(todoRegex);

    if (newLineMatch && oldLineMatch) {
      const [_n, newLinePrefix, newLineCheck, newLineSuffix] = newLineMatch;
      const [_o, oldLinePrefix, oldLineCheck, oldLineSuffix] = oldLineMatch;

      if (
        newLinePrefix === oldLinePrefix &&
        newLineSuffix === oldLineSuffix &&
        newLineCheck !== oldLineCheck
      ) {
        this._sortTodos(editor);
      }
    }
  };

  _lastSort = new Date();
  _lastSortedValue = "";
  _sortTodos = (editor: Editor) => {
    const began = new Date();
    const value = editor.getValue();
    if (value === this._lastSortedValue) {
      return;
    }
    if (new Date().getTime() - this._lastSort.getTime() < 100) {
      console.error("WARNING!!! Possible infinite sort detected");
      return;
    }
    const cursor = editor.getCursor();
    const lineNumber = cursor.line;
    const result = sortTodos(value, this.settings.sortOrder);
    if (result.output !== value) {
      const now = new Date();
      console.log(`Sorted todos in ${now.getTime() - began.getTime()}ms`);
      this._lastSort = now;
      this._lastSortedValue = result.output;
      this._previousEditorValue = result.output;
      editor.setValue(result.output);
      const newLine = result.lineMap[lineNumber];
      editor.setCursor({
        line: newLine,
        ch: cursor.ch,
      });
    }
  };
}
