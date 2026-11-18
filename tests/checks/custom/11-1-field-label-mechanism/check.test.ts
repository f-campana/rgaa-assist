/**
 * `custom/11-1-field-label-mechanism`: one test per numbered step of the
 * record and per group of elements it names, plus hidden fields, frames,
 * shadow trees, script-inserted fields and unread documents. Every result
 * goes through the engine (`observe`).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import { launchBrowser } from "../../../../src/engine/index.ts";
import { observe } from "../../../../src/engine/testing/index.ts";
import type { FixtureFiles, FixtureOptions } from "../../../../src/engine/testing/index.ts";
import { familyCProvider } from "../../../../src/checks/custom/family-c/provider.ts";
import type { Observation } from "../../../../src/schema/index.ts";

const ID = "custom/11-1-field-label-mechanism";
let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser.close();
});

async function check(files: FixtureFiles, options: FixtureOptions = {}): Promise<Observation> {
  const obs = await observe(familyCProvider, files, { browser, ...options });
  const o = obs.find((x) => x.checkId === ID);
  if (o === undefined) throw new Error("no observation");
  return o;
}

const page = (body: string): string => `<!doctype html><html lang="fr"><head><title>t</title></head><body><form>${body}</form></body></html>`;
const one = (body: string): Promise<Observation> => check({ "index.html": page(body) });
const notes = (o: Observation): string => o.evidence.map((e) => e.note ?? "").join("\n");
const faults = (o: Observation): number => o.evidence.filter((e) => e.kind === "dom_node" && (e.note ?? "").startsWith("Step (2)")).length;

describe(ID, () => {
  it("not fields: inputs of type submit, reset, hidden, image, button, <button> and role=button are skipped (inapplicable)", async () => {
    const o = await one(
      `<input type="submit"><input type="RESET"><input type="hidden" name="t"><input type="image" src="x.png" alt="ok"><input type="button" value="b"><button>Envoyer</button><div role="button" tabindex="0"></div>`,
    );
    expect(o.outcome).toBe("inapplicable");
    expect(o.evidence[0]?.kind).toBe("scope_examined");
  });

  it("never faulted: other input types, option, optgroup, datalist, roles option/checkbox/radio/switch, a combobox wrapping an input, a listbox a combobox controls", async () => {
    const o = await one(
      `<input type="foo"><input type="">` +
        `<datalist id="dl"><option value="a"></option></datalist>` +
        `<div role="checkbox" aria-checked="false" tabindex="0"></div><div role="switch" tabindex="0"></div><div role="radio"></div><div role="option"></div>` +
        `<div role="combobox"><input aria-label="Ville"></div>` +
        `<div role="combobox" aria-controls="lb" tabindex="0" aria-label="Pays"></div><ul role="listbox" id="lb"></ul>`,
    );
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o)).toContain("Not decided by the record (input of another type)");
    expect(notes(o)).toContain("Not decided by the record (datalist)");
    expect(notes(o)).toContain("Not decided by the record (role switch)");
    expect(notes(o)).toContain("role combobox containing an input");
    expect(notes(o)).toContain("role listbox controlled or owned by a combobox");
    expect(faults(o)).toBe(0);
  });

  it("step (1): a field not rendered, under aria-hidden, inert, or in a hidden frame is cannot_tell", async () => {
    const o = await check({
      "index.html": page(
        `<input style="display:none"><div style="visibility:hidden"><textarea></textarea></div><div aria-hidden="true"><select><option>a</option></select></div>` +
          `<div inert><input type="email"></div><iframe title="f" src="f.html" style="display:none"></iframe>`,
      ),
      "f.html": page(`<input>`),
    });
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o).match(/Step \(1\)/g)?.length).toBe(5);
  });

  describe("step (2): a field with no labelling mechanism at all is a fault", () => {
    it("input, select, textarea, output, progress, meter and the field roles", async () => {
      const o = await one(
        `<input><input type="TEXT"><input type="checkbox"><select><option>a</option></select><textarea></textarea><output></output><progress></progress><meter value="1"></meter>` +
          `<div role="textbox" contenteditable="true"></div><div role="slider" tabindex="0"></div><div role="searchbox"></div>`,
      );
      expect(o.outcome).toBe("fault");
      expect(faults(o)).toBe(11);
    });

    it("a placeholder is not a mechanism", async () => {
      const o = await one(`<input type="search" placeholder="Rechercher">`);
      expect(o.outcome).toBe("fault");
      expect(o.fingerprint).toBe(`${ID}:input[type=search]`);
    });

    it("a field visually hidden with clip and inserted by a script after load (the dry run's filter widget)", async () => {
      const o = await one(
        `<div class="w"></div><script>addEventListener('load', () => { const i = document.createElement('input'); i.className = 'awsm-selectric-input'; i.tabIndex = 0;
          i.style.cssText = 'position:absolute;clip:rect(0,0,0,0);width:1px;height:1px'; document.querySelector('.w').append(i); });</script>`,
      );
      expect(o.outcome).toBe("fault");
      expect(o.fingerprint).toBe(`${ID}:input.awsm-selectric-input`);
    });
  });

  it("step (3): a present mechanism is cannot_tell, never a fault, whatever its value", async () => {
    const o = await one(
      `<input aria-label=""><input aria-labelledby="missing"><input title="Nom"><label for="a">Nom</label><input id="a">` +
        `<label>Ville <input></label><label>Pays</label><input aria-describedby="x" title="">`,
    );
    expect(o.outcome).toBe("cannot_tell");
    expect(notes(o).match(/Step \(3\)/g)?.length).toBe(6);
  });

  it("a label ancestor across a shadow boundary, or a label for in the same shadow tree, is a mechanism", async () => {
    const o = await one(
      `<label>Nom <x-in id="h1"></x-in></label><x-in id="h2"></x-in>` +
        `<script>document.getElementById('h1').attachShadow({mode:'open'}).innerHTML = '<input>';
          document.getElementById('h2').attachShadow({mode:'closed'}).innerHTML = '<label for="z">Z</label><input id="z">';</script>`,
    );
    expect(o.outcome).toBe("cannot_tell");
    expect(faults(o)).toBe(0);
  });

  it("a field in a closed shadow tree with no mechanism is a fault", async () => {
    const o = await one(`<x-in id="h"></x-in><script>document.getElementById('h').attachShadow({mode:'closed'}).innerHTML = '<input>';</script>`);
    expect(o.outcome).toBe("fault");
    expect(o.evidence[0]?.locator).toBe("x-in#h >> input");
  });

  it("a field in a cross-site frame is examined", async () => {
    const o = await check({
      "index.html": page(`<label for="q">Q</label><input id="q"><iframe id="f" title="f" src="__CROSS_ORIGIN__/f.html"></iframe>`),
      "f.html": page(`<input name="email">`),
    });
    expect(o.outcome).toBe("fault");
    expect(o.evidence[0]?.locator).toBe("iframe#f >>> html > body > form > input");
  });

  it("page result: a fault wins over fields the check abstains on", async () => {
    const o = await one(`<input aria-label="a"><input>`);
    expect(o.outcome).toBe("fault");
    expect(faults(o)).toBe(1);
  });

  it("an unread nested document makes the page cannot_tell instead of inapplicable; a fault still wins", async () => {
    const busy = page(`<script>addEventListener('load', () => setTimeout(() => { for (;;) {} }, 50));</script>`);
    const ct = await check({ "index.html": page(`<button>x</button><iframe title="b" src="__CROSS_ORIGIN__/busy.html"></iframe>`), "busy.html": busy }, { timeouts: { frameProbe: 500 } });
    expect(ct.outcome).toBe("cannot_tell");
    expect(notes(ct)).toContain("Not read");
    const fault = await check({ "index.html": page(`<input><iframe title="b" src="__CROSS_ORIGIN__/busy.html"></iframe>`), "busy.html": busy }, { timeouts: { frameProbe: 500 } });
    expect(fault.outcome).toBe("fault");
  });
});
