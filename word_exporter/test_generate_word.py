# -*- coding: utf-8 -*-

import unittest
from pathlib import Path

from generate_word import build_screenshot_entries, parse_site_name_from_filename


class ScreenshotMetadataTests(unittest.TestCase):
    def test_site_name_is_read_from_filename_instead_of_config_position(self) -> None:
        screenshots = [
            Path("01_自定义核查网站_测试公司_20260713_153000.png"),
        ]
        default_sites = [
            {"name": "信用中国", "url": "https://www.creditchina.gov.cn/"},
        ]

        entries = build_screenshot_entries(screenshots, default_sites, "测试公司")

        self.assertEqual(entries[0]["siteName"], "自定义核查网站")
        self.assertEqual(entries[0]["url"], "")
        self.assertEqual(entries[0]["siteIndex"], "1")

    def test_config_url_is_matched_by_site_name_not_index(self) -> None:
        screenshots = [
            Path("01_国家企业信用信息公示系统_测试公司_20260713_153000.png"),
        ]
        reordered_sites = [
            {"name": "信用中国", "url": "https://credit.example/"},
            {"name": "国家企业信用信息公示系统", "url": "https://gsxt.example/"},
        ]

        entries = build_screenshot_entries(screenshots, reordered_sites, "测试公司")

        self.assertEqual(entries[0]["siteName"], "国家企业信用信息公示系统")
        self.assertEqual(entries[0]["url"], "https://gsxt.example/")

    def test_subject_suffix_is_removed_from_site_name(self) -> None:
        filename = "08_某_网站_上海_测试_公司_20260713_153000.png"

        site_name = parse_site_name_from_filename(filename, "上海 测试 公司")

        self.assertEqual(site_name, "某 网站")


if __name__ == "__main__":
    unittest.main()
