#!/usr/bin/env python3
"""Report source points nearest a coordinate, for data completeness checks."""
import argparse
import heapq
import json
import math

def distance_m(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2-p1, math.radians(lon2-lon1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 6371000 * 2 * math.asin(min(1, math.sqrt(a)))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--lat", type=float, required=True)
    ap.add_argument("--lon", type=float, required=True)
    ap.add_argument("--count", type=int, default=10)
    args=ap.parse_args()
    nearest=[]
    sequence=0
    within={100:0,500:0,1000:0,5000:0}
    with open(args.file, encoding="utf-8") as f:
        for line in f:
            feat=json.loads(line)
            lon,lat=feat["geometry"]["coordinates"]
            d=distance_m(args.lat,args.lon,lat,lon)
            for radius in within:
                if d<=radius: within[radius]+=1
            sequence+=1
            if len(nearest)<args.count:
                heapq.heappush(nearest,(-d,sequence,feat))
            elif d < -nearest[0][0]:
                heapq.heapreplace(nearest,(-d,sequence,feat))
    print(f"Reference point: {args.lat}, {args.lon}")
    print("Counts by radius (metres):", within)
    for neg_d, _, feat in sorted(nearest,reverse=True):
        print(f"{-neg_d:.0f}m",feat["geometry"]["coordinates"],json.dumps(feat["properties"],ensure_ascii=False))

if __name__=="__main__":
    main()
