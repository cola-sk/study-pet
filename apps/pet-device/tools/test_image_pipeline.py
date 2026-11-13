"""Offline regression checks; never calls TinyPNG or reads a real API key."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import random
import tempfile
import unittest
from unittest.mock import patch
from PIL import Image, PngImagePlugin

TOOLS=Path(__file__).resolve().parent

def module(name):
    spec=importlib.util.spec_from_file_location(name,TOOLS/(name+'.py'))
    result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result
compress=module('compress_tinypng');embed=module('embed_frames')

def png(metadata=False):
    buffer=io.BytesIO();extra=PngImagePlugin.PngInfo()
    if metadata:extra.add_text('test','original metadata '*500)
    Image.new('RGB',(140,132),(255,247,231)).save(buffer,format='PNG',pnginfo=extra)
    return buffer.getvalue()

class ImagePipelineTests(unittest.TestCase):
    def run_compression(self,original,optimized):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);frames=root/'frames';frames.mkdir();path=frames/'idle_01.png';path.write_bytes(original)
            changes={'FRAMES':frames,'MANIFEST':root/'manifest.json','BACKUP':root/'backup','NAMES':['idle_01.png']}
            response=json.dumps({'output':{'url':'https://api.tinify.com/output/test'}}).encode()
            with patch.multiple(compress,**changes), patch.object(compress,'key',return_value='fake-test-key'), patch.object(compress.urllib.request,'urlopen',side_effect=[io.BytesIO(response),io.BytesIO(optimized)]) as network, contextlib.redirect_stdout(io.StringIO()):
                compress.main()
                self.assertEqual(network.call_count,2)
                actual=path.read_bytes();report=json.loads((root/'manifest.json').read_text())['frames']['idle_01.png']
                compress.main()
                self.assertEqual(network.call_count,2,'cached files must not call the API again')
                return actual,report
    def test_larger_output_keeps_original_bytes_and_format(self):
        original=png();actual,report=self.run_compression(original,original+b'larger response'*100)
        self.assertEqual(actual,original);self.assertEqual(report['output_bytes'],len(original))
        self.assertEqual(Image.open(io.BytesIO(actual)).format,'PNG')
    def test_equal_output_keeps_original(self):
        original=png();self.assertEqual(self.run_compression(original,original)[0],original)
    def test_smaller_output_is_used(self):
        optimized=png();original=png(metadata=True)
        actual,report=self.run_compression(original,optimized)
        self.assertEqual(actual,optimized);self.assertLess(report['output_bytes'],report['input_bytes'])
    def test_embedding_selects_png_or_original_rgb565_per_frame(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            for n in range(1,5):(root/f'idle_{n:02}.png').write_bytes(png())
            Image.frombytes('RGB',(140,132),random.Random(7).randbytes(140*132*3)).save(root/'idle_04.png',compress_level=0)
            with patch.object(embed,'ACTIONS',('idle',)), contextlib.redirect_stdout(io.StringIO()):
                report=embed.embed(root,root/'frames.c')
            self.assertEqual([r['format'] for r in report],['png','png','png','rgb565'])
            self.assertTrue(all(r['encoded_bytes']<=r['rgb565_bytes'] for r in report))
            self.assertIn('LV_IMG_CF_TRUE_COLOR', (root/'frames.c').read_text())

if __name__=='__main__':unittest.main()
