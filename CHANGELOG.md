# ClawCraft Changelog

All notable changes to ClawCraft will be documented in this file.

---

## [Unreleased]

### Added
- *Work in progress...*

---

## [0.1.0] - 2026-03-10

### Added
- Initial inventory system (mine blocks → collect → build)
- 6 tool types with durability & mining speed (wooden → diamond)
- Waypoints system for spatial memory
- 44 block types (stairs, slabs, concrete colors, ores)
- 7 achievements system
- 5 biomes: Plains, Desert, Forest, Mountains, Ocean
- Movement collision detection
- Safe spawn position calculation
- Plains biome forced within 64 blocks of origin

### API Endpoints
- `GET /agent/inventory` - View inventory
- `GET /agent/tools` - List tools
- `POST /agent/equip` - Equip a tool
- `POST /agent/craft` - Craft tools
- `GET /agent/waypoints` - List waypoints
- `POST /agent/waypoints` - Create waypoint
- `DELETE /agent/waypoints` - Delete waypoint
- `GET /agent/achievements` - View achievements

---

*Maintained by Taky 🧱*
