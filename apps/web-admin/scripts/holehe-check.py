#!/usr/bin/env python3
"""
Holehe Email Checker - Check if email is registered on 120+ sites
Usage: python3 holehe-check.py email@example.com
Output: JSON with found accounts
"""

import sys
import json
import asyncio

try:
    import httpx
    from holehe import core
except ImportError:
    print(json.dumps({"error": "holehe not installed. Run: pip3 install holehe"}))
    sys.exit(1)

async def check_email(email):
    """Check email against all Holehe modules"""
    results = []
    found = []

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Get all modules from holehe
        modules = core.import_submodules('holehe.modules')

        # Create tasks for all checks
        tasks = []
        for module_name, module in modules.items():
            # Each module has a function with the same name as the file
            func_name = module_name.split('.')[-1]
            if hasattr(module, func_name):
                func = getattr(module, func_name)
                tasks.append(run_check(func, email, client, results))

        # Run all checks concurrently
        await asyncio.gather(*tasks, return_exceptions=True)

    # Filter to only found accounts
    for r in results:
        if isinstance(r, dict) and r.get('exists') == True:
            found.append({
                "name": r.get('name', 'Unknown'),
                "exists": True,
                "emailRecovery": r.get('emailrecovery'),
                "phoneNumber": r.get('phoneNumber'),
                "url": get_site_url(r.get('name', ''))
            })

    return found

async def run_check(func, email, client, results):
    """Run a single check safely"""
    try:
        await func(email, client, results)
    except Exception:
        pass

def get_site_url(name):
    """Get URL for known sites"""
    urls = {
        'instagram': 'https://instagram.com',
        'twitter': 'https://twitter.com',
        'facebook': 'https://facebook.com',
        'linkedin': 'https://linkedin.com',
        'pinterest': 'https://pinterest.com',
        'spotify': 'https://spotify.com',
        'discord': 'https://discord.com',
        'github': 'https://github.com',
        'gitlab': 'https://gitlab.com',
        'snapchat': 'https://snapchat.com',
        'tiktok': 'https://tiktok.com',
        'tumblr': 'https://tumblr.com',
        'amazon': 'https://amazon.com',
        'ebay': 'https://ebay.com',
        'adobe': 'https://adobe.com',
        'netflix': 'https://netflix.com',
        'spotify': 'https://spotify.com',
        'steam': 'https://steampowered.com',
        'duolingo': 'https://duolingo.com',
        'strava': 'https://strava.com',
        'imgur': 'https://imgur.com',
        'gravatar': 'https://gravatar.com',
        'wordpress': 'https://wordpress.com',
        'medium': 'https://medium.com',
        'quora': 'https://quora.com',
        'reddit': 'https://reddit.com',
    }
    return urls.get(name.lower(), f'https://{name.lower()}.com')

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python3 holehe-check.py email@example.com"}))
        sys.exit(1)

    email = sys.argv[1]

    try:
        found = asyncio.run(check_email(email))
        print(json.dumps({
            "email": email,
            "found": found,
            "count": len(found)
        }))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
