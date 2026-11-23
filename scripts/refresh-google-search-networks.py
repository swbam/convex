"""Check the Google Search firewall exception. Pass --apply to refresh its IP networks."""
import argparse
import ipaddress
import json
import subprocess

GOOGLE_RANGES = "https://developers.google.com/static/crawling/ipranges/common-crawlers.json"
PROJECT = "prj_X4KmucdykljUY0j6XbNM9kYA4squ"
TEAM = "team_uHCaOk37MPItZUv2QG0Nucm6"
RULE = "Allow verified Google Search on public catalog"


def vercel(path, changes=None):
    command = ["vercel", "api", f"/v1/security/firewall/config{path}?projectId={PROJECT}&teamId={TEAM}", "--scope", TEAM]
    if changes:
        command.extend(["--method", "PATCH", "--input", "-"])
    result = subprocess.run(command, input=json.dumps(changes) if changes else None,
                            text=True, stdout=subprocess.PIPE, check=True)
    return json.loads(result.stdout)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    source = subprocess.check_output(["curl", "--fail", "--silent", "--show-error",
                                      "--max-time", "30", GOOGLE_RANGES], text=True)
    prefixes = json.loads(source)["prefixes"]
    networks = [ipaddress.ip_network(row.get("ipv4Prefix") or row["ipv6Prefix"]) for row in prefixes]
    if {net.version for net in networks} != {4, 6} or not all(net.is_global and net.prefixlen for net in networks):
        raise SystemExit("Invalid Google crawler network list.")
    ranges = [str(net) for version in (4, 6) for net in ipaddress.collapse_addresses(
        net for net in networks if net.version == version)]
    config = vercel("/active")
    rule, = [item for item in config["rules"] if item["name"] == RULE]
    condition, = [entry for group in rule["conditionGroup"] for entry in group["conditions"]
                  if entry["type"] == "ip_address" and entry["op"] == "inc"]
    if set(ranges) == set(condition["value"]):
        print(f"Current Google Search networks match the firewall ({len(ranges)} ranges).")
        return
    if not args.apply:
        raise SystemExit("Google changed its crawler networks. Run this command with --apply to refresh.")
    condition["value"] = ranges
    value = {key: rule[key] for key in ("name", "description", "active", "action", "conditionGroup")}
    vercel("", {"action": "rules.update", "id": rule["id"], "value": value})
    print(f"Updated the Google Search exception to {len(ranges)} networks.")


if __name__ == "__main__":
    main()
