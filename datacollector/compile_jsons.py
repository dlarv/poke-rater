"""Compile individual pokemon json files into one"""
import os
import json

path = f"{os.path.dirname(__file__)}/data"
output = {}
with open('./total.json', 'w', encoding='utf-8') as stream:
    for file in os.listdir(path):
        obj_name = file.removesuffix(".json")
        with open(f"{path}/{file}", 'r', encoding='utf-8') as stream2:
            obj = json.load(stream2)
            output[obj_name] = obj
    stream.write(json.dumps(output))

