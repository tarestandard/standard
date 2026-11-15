/*
 * Copy control for the citation block.
 *
 * No dependencies and no framework. A button with `data-copy="<id>"` copies the
 * text of the element with that id; `data-copy-label` names it in the live
 * message ("Citation", "URL"). The status element is the nearest
 * `.copy-status`, so a page can carry more than one citation.
 *
 * The button's pristine label is stored once, so a second click inside the
 * restore window cannot capture "Copied" as the label to restore. Each button
 * and each status element owns one timer; a new click clears the previous one
 * instead of stacking a second timer that would clear a later message.
 *
 * If the file is blocked, missing, or JavaScript is off, nothing here runs and
 * the citation is still selectable: the markup is the fallback. The URL is
 * always printed as text on screen, never only as a copied value.
 */
(() => {
  const statusFor = (button) =>
    button.closest(".cite-body")?.querySelector(".copy-status") ??
    document.querySelector(".copy-status");

  const buttonTimers = new WeakMap();
  const statusTimers = new WeakMap();

  const say = (element, message) => {
    if (!element) return;
    const previous = statusTimers.get(element);
    if (previous !== undefined) clearTimeout(previous);
    element.textContent = message;
    if (message !== "") {
      statusTimers.set(
        element,
        window.setTimeout(() => {
          element.textContent = "";
        }, 4000),
      );
    }
  };

  const select = (target) => {
    const selection = window.getSelection();
    if (selection === null) return false;
    const range = document.createRange();
    range.selectNodeContents(target);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  };

  const copy = async (target) => {
    const text = (target.textContent ?? "").trim();
    if (text === "") return false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // The browser refused the clipboard; use the selection path below.
      }
    }
    try {
      if (select(target) && document.execCommand("copy")) return true;
    } catch {
      // Some WebViews and sandboxed frames throw instead of returning false.
    }
    select(target);
    return false;
  };

  document.addEventListener("click", async (event) => {
    const origin = event.target instanceof Element ? event.target.closest("[data-copy]") : null;
    if (!(origin instanceof HTMLButtonElement)) return;
    const target = document.getElementById(origin.dataset.copy ?? "");
    if (target === null) return;

    // The first click stores the label the button shipped with; later clicks
    // reuse it instead of reading the transient "Copied".
    if (origin.dataset.pristineLabel === undefined) {
      origin.dataset.pristineLabel = (origin.textContent ?? "").trim();
    }
    const label = origin.dataset.copyLabel ?? "Citation";
    const status = statusFor(origin);
    const previous = buttonTimers.get(origin);
    if (previous !== undefined) clearTimeout(previous);

    const copied = await copy(target);
    say(
      status,
      copied ? `${label} copied.` : `Copy failed — the ${label.toLowerCase()} is selected.`,
    );
    origin.textContent = copied ? "Copied" : "Select and copy";
    buttonTimers.set(
      origin,
      window.setTimeout(() => {
        origin.textContent = origin.dataset.pristineLabel ?? label;
      }, 4000),
    );
  });
})();
