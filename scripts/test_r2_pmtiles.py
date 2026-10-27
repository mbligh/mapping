#!/usr/bin/env python3
"""Check R2 versioned object/manifest generation without credentials."""
import importlib.machinery
import importlib.util
import pathlib
import tempfile
import unittest

script=pathlib.Path(__file__).with_name('r2_pmtiles')
loader=importlib.machinery.SourceFileLoader('r2_pmtiles', str(script))
spec=importlib.util.spec_from_loader(loader.name, loader)
r2=importlib.util.module_from_spec(spec)
loader.exec_module(r2)


class ManifestTest(unittest.TestCase):
    def test_content_addressed(self):
        with tempfile.TemporaryDirectory() as td:
            archive=pathlib.Path(td)/'surveillance.pmtiles'
            archive.write_bytes(b'tile-data')
            key, doc=r2.manifest('surveillance',archive,'https://tiles.mbligh.org/')
            self.assertTrue(key.startswith('versions/surveillance-'))
            self.assertTrue(key.endswith('.pmtiles'))
            self.assertEqual(doc['url'], 'https://tiles.mbligh.org/'+key)
            previous=doc['version']
            self.assertEqual(len(previous),64)
            archive.write_bytes(b'new-tile-data')
            key2, doc2=r2.manifest('surveillance',archive,'https://tiles.mbligh.org')
            self.assertNotEqual(key,key2)
            self.assertNotEqual(doc2['version'],previous)


if __name__=='__main__':
    unittest.main()
