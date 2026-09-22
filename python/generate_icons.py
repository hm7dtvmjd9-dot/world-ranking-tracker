import zlib
import struct
import math

def create_athletic_png(size, output_path):
    width, height = size, size
    raw_data = bytearray()
    
    center_x, center_y = width / 2.0, height / 2.0
    radius = width * 0.46
    corner_radius = width * 0.22
    
    for y in range(height):
        raw_data.append(0)  # Filter byte: None
        for x in range(width):
            # Check rounded box bounds
            dx = max(0, abs(x - center_x) - (width/2 - corner_radius))
            dy = max(0, abs(y - center_y) - (height/2 - corner_radius))
            dist_sq = dx * dx + dy * dy
            
            if dist_sq > corner_radius * corner_radius:
                # Transparent outside rounded squircle
                raw_data.extend((0, 0, 0, 0))
                continue
            
            # Base dark obsidian gradient (#0f172a to #020617)
            grad_t = (x + y) / (width + height)
            r = int(15 * (1 - grad_t) + 2 * grad_t)
            g = int(23 * (1 - grad_t) + 6 * grad_t)
            b = int(42 * (1 - grad_t) + 23 * grad_t)
            a = 255
            
            # Draw Takeoff Board (Electric Cyan #06b6d4)
            board_y1 = int(height * 0.72)
            board_y2 = int(height * 0.77)
            board_x1 = int(width * 0.18)
            board_x2 = int(width * 0.42)
            if board_y1 <= y <= board_y2 and board_x1 <= x <= board_x2:
                # Board
                r, g, b = 6, 182, 212
            elif board_y1 <= y <= board_y2 and board_x2 < x <= int(width * 0.47):
                # Plasticine foul indicator line (Red #ef4444)
                r, g, b = 239, 68, 68
                
            # Draw Jump Parabolic Arc (glow cyan)
            # y = -4 * h * (x-x0)(x1-x)/(x1-x0)^2
            arc_x0 = width * 0.24
            arc_x1 = width * 0.82
            if arc_x0 <= x <= arc_x1:
                norm_x = (x - arc_x0) / (arc_x1 - arc_x0)
                apex_y = height * 0.72 - (height * 0.45) * math.sin(norm_x * math.pi)
                dist_to_arc = abs(y - apex_y)
                if dist_to_arc < width * 0.022:
                    r, g, b = 34, 211, 238
                elif dist_to_arc < width * 0.045:
                    blend = (width * 0.045 - dist_to_arc) / (width * 0.023)
                    r = int(r * (1 - blend) + 6 * blend)
                    g = int(g * (1 - blend) + 182 * blend)
                    b = int(b * (1 - blend) + 212 * blend)
            
            # Head of jumper at apex
            head_cx, head_cy = width * 0.52, height * 0.32
            head_dist = math.hypot(x - head_cx, y - head_cy)
            if head_dist <= width * 0.045:
                r, g, b = 255, 255, 255
                
            # Landing Target (Gold / Amber #f59e0b)
            target_cx, target_cy = width * 0.78, height * 0.72
            target_dist = math.hypot(x - target_cx, y - target_cy)
            if target_dist <= width * 0.05:
                r, g, b = 245, 158, 11
            
            raw_data.extend((r, g, b, a))
            
    # Encode PNG chunks
    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xffffffff
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', crc)
    
    png = bytearray(b'\x89PNG\r\n\x1a\n')
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png.extend(chunk(b'IHDR', ihdr_data))
    png.extend(chunk(b'IDAT', zlib.compress(bytes(raw_data), 9)))
    png.extend(chunk(b'IEND', b''))
    
    with open(output_path, 'wb') as f:
        f.write(png)
    print(f"Generated PNG icon: {output_path} ({width}x{height})")

if __name__ == '__main__':
    create_athletic_png(512, 'icons/icon-512.png')
    create_athletic_png(192, 'icons/icon-192.png')
    create_athletic_png(180, 'icons/apple-touch-icon.png')
