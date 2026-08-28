#!/usr/bin/env python3
"""Insert the POC merge-tag sections into the supplied Visture DOCX template."""

from copy import deepcopy
import argparse
from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from xml.etree import ElementTree as ET


DEFAULT_SOURCE = Path.home() / 'Downloads' / 'Visture Proposal Template.docx'
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / 'Visture Proposal Template - Merge Tags Updated.docx'
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W}


def qn(name):
    return f'{{{W}}}{name}'


def paragraph_text(node):
    return ''.join(text.text or '' for text in node.findall('.//w:t', NS)).strip()


def set_single_text(node, value):
    texts = node.findall('.//w:t', NS)
    if not texts:
        raise RuntimeError('Expected a text run in the cloned paragraph.')
    texts[0].text = value
    for text in texts[1:]:
        text.text = ''


def set_heading(node, number, title):
    runs = node.findall('./w:r', NS)
    if len(runs) < 2:
        raise RuntimeError('Expected number and title runs in the heading paragraph.')
    set_single_text(runs[0], f'{number}  ')
    set_single_text(runs[1], title)


def replace_text(root, old, new):
    for text in root.findall('.//w:t', NS):
        if text.text and old in text.text:
            text.text = text.text.replace(old, new)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', nargs='?', type=Path, default=DEFAULT_SOURCE)
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    source = args.source.expanduser().resolve()
    output = args.output.expanduser().resolve()
    if not source.exists():
        raise SystemExit(f'Source template not found: {source}')

    with ZipFile(source) as archive:
        document_xml = archive.read('word/document.xml')
        archive_entries = [(item, archive.read(item.filename)) for item in archive.infolist()]

    namespaces = dict(ET.iterparse(BytesIO(document_xml), events=('start-ns',)))
    for prefix, uri in namespaces.items():
        ET.register_namespace(prefix, uri)

    root = ET.fromstring(document_xml)
    body = root.find('w:body', NS)
    paragraphs = [node for node in body if node.tag == qn('p')]

    def find_paragraph(value):
        return next(node for node in paragraphs if paragraph_text(node) == value)

    heading_model = find_paragraph('3  Scope of work')
    intro_model = find_paragraph('The work below is what Visture will build, room by room. Anything not listed here is outside this proposal — see Exclusions.')
    tag_model = find_paragraph('{{scope_of_work}}')
    label_model = find_paragraph('Site intake & estimate record')
    investment = find_paragraph('4  Investment')

    inserted = []

    def heading(number, title):
        node = deepcopy(heading_model)
        set_heading(node, number, title)
        inserted.append(node)

    def intro(value):
        node = deepcopy(intro_model)
        set_single_text(node, value)
        inserted.append(node)

    def label(value):
        node = deepcopy(label_model)
        set_single_text(node, value)
        inserted.append(node)

    def tag(value):
        node = deepcopy(tag_model)
        set_single_text(node, f'{{{{{value}}}}}')
        inserted.append(node)

    heading(4, 'Client-visible specifications')
    intro('The finishes, systems and performance details below explain what is included and why it matters to the completed project.')
    tag('client_specifications')

    heading(5, 'Detailed estimate')
    intro('The approved estimate is organized as shown below. Material and labour values remain subject to JG review before this proposal is sent.')
    label('Estimate organization')
    tag('estimate_grouping')
    label('Itemized materials')
    tag('material_pricing')
    label('Materials subtotal')
    tag('material_subtotal')
    label('Labour calculation summary')
    tag('labour_pricing')
    label('Estimated labour hours')
    tag('labour_hours')
    label('Hourly labour rate')
    tag('labour_hourly_rate')
    label('Labour subtotal')
    tag('labour_total')
    label('Materials + labour subtotal')
    tag('estimate_subtotal')

    heading(6, 'Allowances & pending quotations')
    intro('Allowances identify included selection amounts. Pending quotations identify pricing that must be confirmed before the commercial assumptions are approved.')
    label('Allowances')
    tag('allowances')
    label('Quote-pending items')
    tag('quote_pending_items')

    insert_at = list(body).index(investment)
    for offset, node in enumerate(inserted):
        body.insert(insert_at + offset, node)

    heading_numbers = {
        'Investment': 7,
        'Assumptions': 8,
        'Exclusions': 9,
        'Options': 10,
        'Reference': 11,
        'Acceptance': 12,
    }
    for node in body.findall('w:p', NS):
        value = paragraph_text(node)
        for title, number in heading_numbers.items():
            if value.endswith(title) and value.split('  ', 1)[0].isdigit():
                set_heading(node, number, title)
                break

    replace_text(root, '{{client_name}}', '{{first_name}} {{surname}}')
    replace_text(root, '{{proposal_date}}', '{{created_date}}')
    replace_text(root, '{{sender_name}}', '{{owner_first_name}} {{owner_surname}}')

    updated_xml = ET.tostring(root, encoding='utf-8', xml_declaration=True)
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, 'w', compression=ZIP_DEFLATED) as archive:
        for item, data in archive_entries:
            archive.writestr(item, updated_xml if item.filename == 'word/document.xml' else data)

    print(output)


if __name__ == '__main__':
    main()
