/**
 * Select Page Keys Extension
 *
 * Makes the tui.select.pageUp / tui.select.pageDown bindings (the Page Up /
 * Page Down keys by default, or alt+v / ctrl+v when rebound) work in
 * selection lists by patching the components that don't natively handle them.
 */

import { Editor, SelectList, SettingsList } from "@earendil-works/pi-tui";
import { getKeybindings } from "@earendil-works/pi-tui";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  ExtensionSelectorComponent,
  ModelSelectorComponent,
  OAuthSelectorComponent,
  ShowImagesSelectorComponent,
  ThemeSelectorComponent,
  ThinkingSelectorComponent,
} from "@earendil-works/pi-coding-agent";

/**
 * Add page up/down handling to a component's handleInput prototype.
 * Inserts checks for tui.select.pageUp/pageDown BEFORE the existing
 * up/down handling.
 */
function patchSelectorHandleInput(
  ComponentClass: any,
  getSelectedIndex: (instance: any) => number,
  setSelectedIndex: (instance: any, index: number) => void,
  getPageSize: (instance: any) => number,
  getTotalItems: (instance: any) => number,
) {
  const origHandleInput = ComponentClass.prototype.handleInput;
  ComponentClass.prototype.handleInput = function (this: any, keyData: string) {
    const kb = getKeybindings();

    // Page up - move selection up by one page
    if (kb.matches(keyData, "tui.select.pageUp")) {
      const total = getTotalItems(this);
      if (total === 0) return;
      setSelectedIndex(this, Math.max(0, getSelectedIndex(this) - getPageSize(this)));
      this.updateList();
      return;
    }

    // Page down - move selection down by one page
    if (kb.matches(keyData, "tui.select.pageDown")) {
      const total = getTotalItems(this);
      if (total === 0) return;
      setSelectedIndex(this, Math.min(total - 1, getSelectedIndex(this) + getPageSize(this)));
      this.updateList();
      return;
    }

    return origHandleInput.call(this, keyData);
  };
}

/**
 * Components that wrap a SelectList in a bare Container have no handleInput,
 * so when the TUI focuses the wrapper, input never reaches the inner list.
 * Delegate everything to the inner SelectList (which the SelectList patch
 * above handles page keys for).
 */
function delegateToSelectList(ComponentClass: any) {
  ComponentClass.prototype.handleInput = function (this: any, keyData: string) {
    if (this.selectList?.handleInput) {
      this.selectList.handleInput(keyData);
    }
  };
}

// Note: no safe shared ancestor to patch instead.
// - SelectList / SettingsList / Editor are independent plain classes.
// - All selector components extend the bare `Container`, but Container is the
//   base of the entire TUI (including TUI itself and every layout container),
//   and a generic handleInput there can't know which child is interactive.
//   So the per-class patches below are the minimal set for this hierarchy.
export default function (_pi: ExtensionAPI) {
  // --- Patch Editor: forward page keys to the autocomplete SelectList when active ---
  // The Editor's own handleInput only forwards up/down/tab/confirm/cancel to
  // the autocomplete list; page keys would fall through and scroll the buffer.
  const origEditorHandleInput = Editor.prototype.handleInput;
  Editor.prototype.handleInput = function (this: any, keyData: string) {
    const kb = getKeybindings();

    if (this.autocompleteState && this.autocompleteList &&
        (kb.matches(keyData, "tui.select.pageUp") || kb.matches(keyData, "tui.select.pageDown"))) {
      this.autocompleteList.handleInput(keyData);
      return;
    }

    return origEditorHandleInput.call(this, keyData);
  };

  // --- Patch SettingsList (used in /settings menu) ---
  // When a submenu (theme/thinking/etc.) is open, SettingsList's own
  // handleInput delegates everything to it. We must do the same BEFORE
  // intercepting page keys, or they'd move the hidden main list instead of
  // the submenu's SelectList.
  const origSettingsListHandleInput = SettingsList.prototype.handleInput;
  SettingsList.prototype.handleInput = function (this: any, keyData: string) {
    const kb = getKeybindings();

    if (this.submenuComponent) {
      this.submenuComponent.handleInput?.(keyData);
      return;
    }

    const displayItems = this.searchEnabled ? this.filteredItems : this.items;

    if (kb.matches(keyData, "tui.select.pageUp")) {
      if (displayItems.length === 0) return;
      this.selectedIndex = Math.max(0, this.selectedIndex - this.maxVisible);
      return;
    }

    if (kb.matches(keyData, "tui.select.pageDown")) {
      if (displayItems.length === 0) return;
      this.selectedIndex = Math.min(displayItems.length - 1, this.selectedIndex + this.maxVisible);
      return;
    }

    return origSettingsListHandleInput.call(this, keyData);
  };

  // --- Patch SelectList (autocomplete, theme/thinking submenus, etc.) ---
  // Autocomplete = the slash-command / file-completion list shown inline below
  // the editor when typing "/" or "@" (or Tab after a partial path). It is a
  // SelectList, so page keys reach it via the Editor patch above.
  const origSelectListHandleInput = SelectList.prototype.handleInput;
  SelectList.prototype.handleInput = function (this: any, keyData: string) {
    const kb = getKeybindings();

    if (kb.matches(keyData, "tui.select.pageUp")) {
      this.selectedIndex = Math.max(0, this.selectedIndex - this.maxVisible);
      this.notifySelectionChange?.();
      return;
    }

    if (kb.matches(keyData, "tui.select.pageDown")) {
      this.selectedIndex = Math.min(this.filteredItems.length - 1, this.selectedIndex + this.maxVisible);
      this.notifySelectionChange?.();
      return;
    }

    return origSelectListHandleInput.call(this, keyData);
  };

  // --- Patch Container-wrapped SelectLists ---
  // ThemeSelector / ThinkingSelector / ShowImagesSelector extend the bare
  // Container (no handleInput), so delegate all input to the inner SelectList.
  delegateToSelectList(ThemeSelectorComponent);
  delegateToSelectList(ThinkingSelectorComponent);
  delegateToSelectList(ShowImagesSelectorComponent);

  // --- Patch selectors with their own handleInput but no page-key handling ---
  // Note: pi's /fork (UserMessageSelectorComponent) is intentionally not
  // patched — pi focuses its internal UserMessageList via getMessageList(),
  // which is not exported, so page keys there cannot be reached from an
  // extension.

  patchSelectorHandleInput(
    ModelSelectorComponent,
    (inst) => inst.selectedIndex,
    (inst, idx) => { inst.selectedIndex = idx; },
    () => 10, // matches render's hardcoded visible count
    (inst) => inst.filteredModels?.length ?? 0,
  );

  // ExtensionSelector = the generic select dialog behind extension
  // `ui.select(...)` prompts and pi's own login/tool-expansion selectors.
  // See it by running an extension that calls ui.select() (or /login).
  patchSelectorHandleInput(
    ExtensionSelectorComponent,
    (inst) => inst.selectedIndex,
    (inst, idx) => { inst.selectedIndex = idx; },
    () => 8,
    (inst) => inst.options?.length ?? 0,
  );

  patchSelectorHandleInput(
    OAuthSelectorComponent,
    (inst) => inst.selectedIndex,
    (inst, idx) => { inst.selectedIndex = idx; },
    () => 8, // matches render's hardcoded visible count
    (inst) => inst.filteredProviders?.length ?? 0,
  );
}
