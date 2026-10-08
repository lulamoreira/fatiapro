import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const src = join(process.cwd(), "src");
const exemptFiles = new Set([
  "components/admin/UsuarioPainel.tsx",
  "components/fatia/ApiKeyWizard.tsx",
]);
const technicalProps = new Set([
  "id", "key", "className", "href", "src", "to", "name", "type", "role",
  "aria-labelledby", "aria-describedby", "htmlFor", "queryKey", "value",
]);

function tsxFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? tsxFiles(path) : path.endsWith(".tsx") ? [path] : [];
  });
}

/** Only the actual isAdmin && subscription subtree is exempt, not the file. */
function subscriptionBlock(node: ts.Node, file: string): boolean {
  if (file !== "components/fatia/ClaudeSection.tsx") return false;
  for (let parent: ts.Node | undefined = node.parent; parent; parent = parent.parent) {
    if (ts.isBinaryExpression(parent)
      && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      && ts.isIdentifier(parent.left) && parent.left.text === "isAdmin"
      && node.pos >= parent.right.pos && node.end <= parent.right.end) return true;
  }
  return false;
}

function isTechnical(node: ts.Node): boolean {
  for (let parent: ts.Node | undefined = node.parent; parent; parent = parent.parent) {
    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)
      || ts.isTypeNode(parent)) return true;
    if (ts.isJsxAttribute(parent) && technicalProps.has(parent.name.getText())) return true;
    if (ts.isPropertyAssignment(parent) && technicalProps.has(parent.name.getText())) return true;
  }
  return false;
}

function violations(code: string, file: string): string[] {
  if (exemptFiles.has(file)) return [];
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  function visit(node: ts.Node): void {
    // AST text nodes exclude comments, identifiers and component names.
    const literal = ts.isJsxText(node) || ts.isStringLiteral(node)
      || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node)
      || ts.isTemplateMiddle(node) || ts.isTemplateTail(node);
    if (literal && /\bClaude\b/i.test(node.text)
      && !/^(?:https?:\/\/|[@./])\S+$/i.test(node.text.trim())
      && !isTechnical(node) && !subscriptionBlock(node, file)) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      found.push(`${file}:${line + 1}: ${node.text.trim()}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return found;
}

describe("marca visível FatiaProAI", () => {
  it("não contém Claude em textos TSX fora das exceções permitidas", () => {
    const found = tsxFiles(src).flatMap((path) =>
      violations(readFileSync(path, "utf8"), relative(src, path).replaceAll("\\", "/")));
    expect(found, found.join("\n")).toEqual([]);
  });

  it("detecta texto, apoio condicional, props e templates sem contar identificadores", () => {
    const code = 'import { ClaudeSection } from "./ClaudeSection"; const Claude = 1; '
      + 'const view = <div id="Claude"><p>Claude</p><Card titulo="Claude" />'
      + '{ok ? "Claude" : `Use Claude ${nome}`}</div>;';
    expect(violations(code, "example.tsx")).toHaveLength(4);
  });

  it("limita a exceção de ClaudeSection ao bloco administrativo de assinatura", () => {
    const code = 'const view = <section><h3>Claude neste computador</h3>'
      + '{isAdmin && <div>Sua assinatura Claude</div>}</section>;';
    expect(violations(code, "components/fatia/ClaudeSection.tsx")).toHaveLength(1);
  });

  it("permite os dois diálogos explicitamente isentos", () => {
    for (const file of exemptFiles) expect(violations('<p>Claude</p>', file)).toEqual([]);
  });
});