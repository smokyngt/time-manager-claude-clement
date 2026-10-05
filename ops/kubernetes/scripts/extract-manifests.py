#!/usr/bin/env python3
import json
import textwrap
import sys


def resources(module):
    yield from module.get("resources", [])
    for child in module.get("child_modules", []):
        yield from resources(child)


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: extract-manifests.py plan.json out.yaml", file=sys.stderr)
        return 2
    with open(sys.argv[1], encoding="utf-8") as handle:
        plan = json.load(handle)
    documents = []
    for resource in resources(plan["planned_values"]["root_module"]):
        if resource["type"] == "kubectl_manifest":
            body = resource["values"].get("yaml_body")
            if body:
                documents.append(textwrap.dedent(body).strip())
    with open(sys.argv[2], "w", encoding="utf-8") as handle:
        handle.write("\n---\n".join(documents) + "\n")
    print(f"{len(documents)} manifests written to {sys.argv[2]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
