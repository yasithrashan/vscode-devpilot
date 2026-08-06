import * as vscode from "vscode";

type Provider = "openai" | "gemini";

let panel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  const openChat = vscode.commands.registerCommand("devpilot.openChat", () => {
    if (panel) {
      panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    panel = vscode.window.createWebviewPanel(
      "devpilot.chat",
      "DevPilot",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "dist"),
          vscode.Uri.joinPath(context.extensionUri, "media"),
        ],
      },
    );
    panel.iconPath = vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      "icon.svg",
    );
    panel.webview.html = getHtml(panel.webview, context.extensionUri);
    panel.onDidDispose(() => (panel = undefined));

    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.type !== "command") {
        return;
      }
      if (message.command === "model") {
        await setModel(context, message.value);
      } else if (message.command === "keys") {
        await setKey(context, message.value);
      }
    });
  });

  context.subscriptions.push(openChat);
}

async function setModel(context: vscode.ExtensionContext, provider: Provider) {
  await context.globalState.update("devpilot.provider", provider);
  panel?.webview.postMessage({
    type: "system",
    text: `Model set to ${provider}`,
  });
}

async function setKey(context: vscode.ExtensionContext, provider: Provider) {
  const value = await vscode.window.showInputBox({
    prompt: `Enter your ${provider} API key`,
    password: true,
    ignoreFocusOut: true,
  });
  if (!value) {
    return;
  }
  await context.secrets.store(`devpilot.${provider}Key`, value);
  panel?.webview.postMessage({
    type: "system",
    text: `API key saved for ${provider}`,
  });
}

function getHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "webview.js"),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "webview.css"),
  );
  const iconUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "icon.svg"),
  );
  const nonce = String(Date.now());

  return `
		<html>
			<head>
				<meta
					http-equiv="Content-Security-Policy"
					content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource};"
				/>
				<link rel="stylesheet" href="${styleUri}" />
			</head>
			<body>
				<div id="root"></div>
				<script nonce="${nonce}">window.__DEVPILOT_ICON__ = "${iconUri}";</script>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
		</html>
	`;
}

export function deactivate() {}
