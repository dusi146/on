// ==========================================================================
// BOSS_GAME.JS - ĐẤU BOSS BỆNH HỌC (TCM DUNGEON BATTLE)
// Mini-game kịch tính giúp khắc sâu các phác đồ huyệt khắc chế bệnh tật
// ==========================================================================

window.BOSS_DATA = [
  {
    id: "boss_1",
    name: "Phong Hàn Tà Thần",
    title: "Trùm Liệt Mặt Méo Miệng (Dây VII)",
    desc: "Gió độc phong hàn thổi vào ban đêm làm kinh lạc kinh Dương Minh bế tắc, mặt lệch sang một bên, mắt nhắm không kín!",
    hp: 100,
    maxHp: 100,
    avatar: "👺",
    weakness: "Huyệt sơ phong, thông kinh lạc vùng mặt & Hợp cốc ở tay",
    effective_points: ["h_5", "h_6", "h_7", "h_4", "h_39", "h_11"], // Nhân trung, Địa thương, Giáp xa, Nghinh hương, Hợp cốc, Ế phong
    point_hints: ["Địa thương", "Giáp xa", "Nhân trung", "Hợp cốc", "Nghinh hương"]
  },
  {
    id: "boss_2",
    name: "Hỏa Ma Tôn",
    title: "Trùm Sốt Cao Co Giật & Cảm Cúm",
    desc: "Nhiệt độc bốc cao làm sốt 39-40 độ, đau nhức đầu như búa bổ, cổ gáy cứng đờ, nguy cơ co giật mê man!",
    hp: 120,
    maxHp: 120,
    avatar: "🔥",
    weakness: "Huyệt hội 6 kinh dương & chích nặn máu thanh nhiệt",
    effective_points: ["h_21", "h_40", "h_35", "h_8", "h_39", "h_60"], // Đại chùy, Thập tuyên, Khúc trì, Phong trì, Hợp cốc, Dũng tuyền
    point_hints: ["Đại chùy", "Thập tuyên", "Khúc trì", "Phong trì", "Dũng tuyền"]
  },
  {
    id: "boss_3",
    name: "Tọa Cốt Thú",
    title: "Quái Vật Đau Thần Kinh Tọa",
    desc: "Khí huyết ứ trệ chèn ép rễ thần kinh, gây cơn đau buốt dọc từ thắt lưng mông lan xuống trám khoeo và bắp chân!",
    hp: 140,
    maxHp: 140,
    avatar: "🐉",
    weakness: "Yêu bối Ủy trung cầu, Hoàn khiêu châm sâu & Thừa sơn giải cơ",
    effective_points: ["h_49", "h_34", "h_53", "h_31", "h_51", "h_52"], // Ủy trung, Hoàn khiêu, Thừa sơn, Đại trường du, Túc tam lý, Dương lăng tuyền
    point_hints: ["Ủy trung", "Hoàn khiêu", "Thừa sơn", "Đại trường du", "Dương lăng tuyền"]
  },
  {
    id: "boss_4",
    name: "Hàn Tả Quỷ",
    title: "Trùm Tiêu Chảy Rốn Lạnh Cấp",
    desc: "Hàn thấp xâm nhập đường ruột, bụng sôi ùng ục, tiêu chảy phân nước, chân tay lạnh ngắt!",
    hp: 110,
    maxHp: 110,
    avatar: "🥶",
    weakness: "Cứu ngải cách muối ở rốn, kiện tỳ vị chỉ tả",
    effective_points: ["h_16", "h_17", "h_51", "h_15", "h_32"], // Thần khuyết, Thiên khu, Túc tam lý, Trung quản, Mệnh môn
    point_hints: ["Thần khuyết", "Thiên khu", "Túc tam lý", "Trung quản", "Mệnh môn"]
  },
  {
    id: "boss_5",
    name: "Vị Quản Thống Ma",
    title: "Trùm Viêm Loét Dạ Dày Cấp",
    desc: "Can khí phạm vị làm đau quặn thắt vùng thượng vị, ợ chua nôn trớ, thức ăn không tiêu!",
    hp: 130,
    maxHp: 130,
    avatar: "🌋",
    weakness: "Khích huyệt cắt đau cấp của kinh Vị & Mộ huyệt Trung quản",
    effective_points: ["h_48", "h_15", "h_51", "h_29", "h_27"], // Lương khâu, Trung quản, Túc tam lý, Vị du, Can du
    point_hints: ["Lương khâu", "Trung quản", "Túc tam lý", "Vị du", "Can du"]
  }
];
