import requests, json, base64, ssl
from urllib.parse import urljoin

BASE = "https://xdata.ur.gov.iq"
CANDIDATES = [
    "/.well-known/jwks.json",
    "/jwks.json",
    "/.well-known/openid-configuration",
    "/.well-known/keys.json",
    "/keys",
    "/certs",
    "/public",
    "/public.pem",
    "/verify?id=268769&format=json",
    "/api/verify?id=268769",
    "/verify?id=268769&raw=1",
]
def b64url_to_int(s):
    return int.from_bytes(base64.urlsafe_b64decode(s + "=="), "big")

def jwk_to_pem(n_b64u, e_b64u):
    from Crypto.Util.number import long_to_bytes
    from Crypto.PublicKey import RSA
    n = b64url_to_int(n_b64u)
    e = b64url_to_int(e_b64u)
    key = RSA.construct((n, e))
    return key.export_key().decode()

hits = {}
for path in CANDIDATES:
    url = urljoin(BASE, path)
    try:
        r = requests.get(url, timeout=8)
        ct = r.headers.get("content-type", "")
        if r.status_code == 200:
            hits[url] = ct
            print("HIT:", url, "->", ct)
            text = r.text
            # openid-configuration
            if "jwks_uri" in text and "application/json" in ct:
                data = r.json()
                jwks_uri = data.get("jwks_uri")
                if jwks_uri:
                    r2 = requests.get(jwks_uri, timeout=8)
                    print("JWKS:", jwks_uri, "->", r2.status_code)
                    if r2.ok:
                        jwks = r2.json()
                        k = jwks["keys"][0]
                        print(jwk_to_pem(k["n"], k["e"]))
                        break
            # direct JWKS
            if "application/json" in ct and "keys" in text:
                jwks = r.json()
                k = jwks["keys"][0]
                print(jwk_to_pem(k["n"], k["e"]))
                break
            # direct PEM
            if "BEGIN PUBLIC KEY" in text or "BEGIN CERTIFICATE" in text:
                print(text)
                break
            # verify JSON that includes publicKey/kid
            if "application/json" in ct and ("publicKey" in text or "kid" in text):
                print(text)
                break
    except Exception as e:
        pass

print("Done.")