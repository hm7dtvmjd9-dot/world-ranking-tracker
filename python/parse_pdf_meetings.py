import zlib
import re

def inspect_pdf(pdf_path):
    print(f"\n=== INSPECTING {pdf_path} ===")
    with open(pdf_path, 'rb') as f:
        content = f.read()

    streams = re.findall(rb'stream\r?\n(.*?)\r?\nendstream', content, re.DOTALL)
    for idx, s in enumerate(streams):
        try:
            decomp = zlib.decompress(s)
            text_str = decomp.decode('latin-1', errors='ignore')
            # Look for lines with Tj or TJ
            lines = re.findall(r'\((.*?)\)\s*Tj|\[(.*?)\]\s*TJ', text_str)
            cleaned_lines = []
            for a, b in lines:
                val = a if a else b
                # clean up octal escapes and TJ array splits
                val = re.sub(r'\\(\d{3})', lambda m: chr(int(m.group(1), 8)), val)
                val = re.sub(r'\\([\\()])', r'\1', val)
                val = re.sub(r'\)[-\d\s\.]+\(', '', val)
                val = val.strip()
                if len(val) > 0:
                    cleaned_lines.append(val)
            if cleaned_lines:
                combined = " | ".join(cleaned_lines)
                if any(k in combined for k in ["Meeting", "Tour", "Silver", "Bronze", "Challenger", "Gorzów", "Toruń", "Madrid", "Liévin", "Karlsruhe", "Dortmund", "Berlin", "Erfurt", "Jablonec", "Ostrava", "Lodz", "Banská", "Kladno", "Lyon", "Miramas", "Val-de-Reuil", "Belgrade"]):
                    print(f"\n[Stream {idx}] Length: {len(cleaned_lines)}")
                    print(combined[:1200])
        except Exception as e:
            pass

if __name__ == '__main__':
    inspect_pdf('data/WIT_Europe_Calendar_2027.pdf')
    inspect_pdf('data/WIT_Europe_Events_2027.pdf')
