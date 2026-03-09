const { run } = require("@ton/crypto");
const { Cell } = require("@ton/core");
const fs = require("fs");
const path = require("path");
const { compileFunc } = require("@ton-community/func-js");

async function main() {
    const result = await compileFunc({
        targets: ["proxy.fc"],
        sources: {
            "imports/stdlib.fc": fs.readFileSync(path.join(__dirname, "func", "imports", "stdlib.fc"), "utf8"),
            "proxy.fc": fs.readFileSync(path.join(__dirname, "func", "proxy.fc"), "utf8"),
        }
    });

    if (result.status === "error") {
        console.error("Compilation error:", result.message);
        process.exit(1);
    }

    const cell = Cell.fromBoc(Buffer.from(result.codeBoc, "base64"))[0];
    const boc = cell.toBoc();
    fs.writeFileSync(path.join(__dirname, "build", "proxy.boc"), boc);
    console.log("Compiled proxy.boc successfully. Length:", boc.length);
}

main().catch(console.error);
