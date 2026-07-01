"""
Renshuu API bulk import script.

SETUP:
1. Get your API key: Renshuu > Resources > renshuu API page (read/write key).
2. Put it in a .env file next to this script (no quotes needed):
       RENSHUU_API_KEY=your_key_here
   (Or export it: export RENSHUU_API_KEY="your_key_here")
3. Create a vocab LIST on Renshuu first (e.g. "Duolingo Import") via the website,
   then find its list_id with --list-lists.
4. Run:
       pip install requests
       python renshuu_import.py --list-lists
       python renshuu_import.py --list-id 123456 --csv duolingo_vocab_clean.csv

This respects the free-tier rate limit (500 req/day) by capping how many
words it processes per run; the shared client also spaces calls out and backs
off on 429. With ~336 words, plan on 2 runs on the free tier (2 calls/word).
"""

import argparse
import csv
import sys
import time

from renshuu_client import (
    add_word_to_list,
    get_lists,
    resolve_api_key,
    search_word,
)

DELAY_SECONDS = 1.0          # gentle pacing between words (client also spaces calls)
MAX_CALLS_PER_RUN = 480      # stay under the 500/day free-tier cap (2 calls/word)


def list_lists(api_key: str):
    data = get_lists(api_key)
    print("Your Renshuu lists (use the list_id with --list-id):")
    for group in data.get("termtype_groups", []):
        termtype = group.get("termtype", "?")
        for sub in group.get("groups", []):
            for lst in sub.get("lists", []):
                print(f"  list_id {lst.get('list_id'):>10}  | {termtype:<7} | "
                      f"{lst.get('title')}  (terms={lst.get('num_terms')})")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", default="duolingo_vocab_clean.csv")
    parser.add_argument("--list-id", default=None)
    parser.add_argument("--list-lists", action="store_true")
    parser.add_argument("--start", type=int, default=0, help="row index to resume from")
    args = parser.parse_args()

    api_key = resolve_api_key()
    if not api_key:
        print("ERROR: set RENSHUU_API_KEY environment variable (or put it in .env) first.")
        sys.exit(1)

    if args.list_lists:
        list_lists(api_key)
        return

    if not args.list_id:
        print("ERROR: provide --list-id (run --list-lists first to find it).")
        sys.exit(1)

    with open(args.csv, encoding="utf-8") as f:
        reader = list(csv.DictReader(f))

    rows = reader[args.start:]
    calls_used = 0
    success, failed = [], []

    for i, row in enumerate(rows, start=args.start):
        if calls_used >= MAX_CALLS_PER_RUN:
            print(f"\nHit per-run cap ({MAX_CALLS_PER_RUN} calls). "
                  f"Resume tomorrow with: --start {i}")
            break

        jp, en = row["Japanese"], row["English"]
        match, note = search_word(api_key, jp)
        calls_used += 1
        time.sleep(DELAY_SECONDS)

        if not match:
            print(f"[{i}] SKIP  {jp} ({en}) - {note}")
            failed.append((jp, en, note))
            continue

        ok, status = add_word_to_list(api_key, match["id"], args.list_id)
        calls_used += 1
        time.sleep(DELAY_SECONDS)

        if ok:
            tag = f" [{note}]" if note else ""
            print(f"[{i}] OK    {jp} -> id {match['id']}{tag}")
            success.append((jp, en))
        else:
            print(f"[{i}] FAIL  {jp} ({en}) - HTTP {status}")
            failed.append((jp, en, f"add failed: HTTP {status}"))

    print(f"\nDone this run. Added: {len(success)}  Failed/skipped: {len(failed)}  "
          f"API calls used: {calls_used}")

    if failed:
        with open("renshuu_import_failed.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["Japanese", "English", "reason"])
            writer.writerows(failed)
        print("Unmatched/failed words saved to renshuu_import_failed.csv "
              "for manual review/addition.")


if __name__ == "__main__":
    main()
