// DANH SÁCH 10 CA BỆNH LÂM SÀNG THỰC CHIẾN - ĐÔNG Y CHÂM CỨU
window.CLINICAL_CASES = [
  {
    id: "case_1",
    title: "Méo miệng sau đêm trúng gió",
    patient: "Bệnh nhân nam 45 tuổi, sáng thức dậy thấy mặt bên phải bị xệ, rãnh mũi má mờ, miệng méo sang trái, uống nước bị trào ra khóe miệng, mắt nhắm không kín.",
    diagnosis: "Liệt dây thần kinh VII ngoại biên do trúng phong hàn.",
    target_points: ["h_5", "h_6", "h_7", "h_4", "h_39"], // Nhân trung, Địa thương, Giáp xa, Nghinh hương, Hợp cốc
    target_names: ["Nhân trung", "Địa thương", "Giáp xa", "Hợp cốc"],
    explanation: "Bộ huyệt vàng chữa liệt VII mặt: Địa thương xuyên Giáp xa, bấm Nhân trung, phối hợp Hợp cốc ở tay (Đầu mặt tìm Hợp Cốc) để khu phong thông kinh hoạt lạc."
  },
  {
    id: "case_2",
    title: "Ngất xỉu đột ngột giữa trời nắng",
    patient: "Học sinh 16 tuổi tập thể dục dưới nắng gắt bị hoa mắt, xây xẩm rồi ngã quỵ bất tỉnh, mạch đập nhanh, chân tay lạnh ngắt.",
    diagnosis: "Choáng ngất do say nắng / hạ huyết áp cấp.",
    target_points: ["h_5", "h_40", "h_60"], // Nhân trung, Thập tuyên, Dũng tuyền
    target_names: ["Nhân trung", "Thập tuyên", "Dũng tuyền"],
    explanation: "Bộ huyệt cấp cứu tỉnh thần: Dùng móng tay bấm mạnh 1/3 trên rãnh Nhân Trung, hoặc chích nặn máu 10 đầu ngón tay (Thập Tuyên) giúp khai khiếu tỉnh thần lập tức."
  },
  {
    id: "case_3",
    title: "Đau thần kinh tọa buốt dọc chân",
    patient: "Bác xe ôm 55 tuổi đau nhói vùng mông lan dọc mặt sau đùi xuống khoeo chân và bắp chân ngoài, cúi xuống nhói không chịu nổi.",
    diagnosis: "Đau dây thần kinh tọa (Tọa cốt phong).",
    target_points: ["h_34", "h_49", "h_51", "h_53", "h_31"], // Hoàn khiêu, Ủy trung, Túc tam lý, Thừa sơn, Đại trường du
    target_names: ["Hoàn khiêu", "Ủy trung", "Thừa sơn"],
    explanation: "'Yêu bối Ủy Trung cầu' - đau thắt lưng lan xuống chân thì Ủy Trung ở trám khoeo là chủ huyệt; phối hợp Hoàn Khiêu (châm sâu 2-3cm) và Thừa Sơn giải phóng chèn ép."
  },
  {
    id: "case_4",
    title: "Đau quặn dạ dày, nôn trớ",
    patient: "Nhân viên văn phòng thức khuya ăn muộn, đau quặn vùng thượng vị trên rốn, ợ chua, nôn nao, ấn vào bụng thấy đau tức khó chịu.",
    diagnosis: "Đau dạ dày cấp tính (Vị quản thống).",
    target_points: ["h_15", "h_48", "h_51", "h_29"], // Trung quản, Lương khâu, Túc tam lý, Vị du
    target_names: ["Trung quản", "Lương khâu", "Túc tam lý"],
    explanation: "Trung Quản là Mộ huyệt của Vị; Lương Khâu là Khích huyệt của kinh Vị (chuyên cắt cơn đau cấp dữ dội); Túc Tam Lý điều hòa tỳ vị, giảm đau tức thì."
  },
  {
    id: "case_5",
    title: "Mẹ bỉm sốt căng tức tia sữa",
    patient: "Sản phụ sau sinh 2 tuần bầu ngực cương cứng, nổi cục sần, sữa không chảy ra được, ngực đau nhức phát sốt 38.5°C.",
    diagnosis: "Tắc tia sữa, viêm tuyến vú thời kỳ cho con bú.",
    target_points: ["h_13", "h_23", "h_24"], // Đản trung, Kiên tỉnh, Thiên tông
    target_names: ["Đản trung", "Kiên tỉnh", "Thiên tông"],
    explanation: "Đản Trung nằm giữa 2 núm vú giải tỏa khí uất ở ngực; Kiên Tỉnh trên vai có tác dụng thông sữa cực nhạy; Thiên Tông ở xương bả vai giúp tán ứ tiêu viêm vú."
  },
  {
    id: "case_6",
    title: "Cảm lạnh sốt cao nhức cứng cổ gáy",
    patient: "Người bệnh dầm mưa bị cảm lạnh, sốt 39°C, sợ gió, đau đầu dữ dội, cứng đờ vùng cổ vai gáy không quay đầu sang hai bên được.",
    diagnosis: "Cảm mạo phong hàn, kinh lạc cổ gáy bế tắc.",
    target_points: ["h_21", "h_8", "h_23", "h_39"], // Đại chùy, Phong trì, Kiên tỉnh, Hợp cốc
    target_names: ["Đại chùy", "Phong trì", "Hợp cốc"],
    explanation: "Đại Chùy (C7-D1) là nơi hội tụ 6 kinh dương giúp hạ sốt giải biểu cực mạnh; Phong Trì sau gáy trục xuất gió độc (phong hàn); Hợp Cốc giải nhiệt toàn thân."
  },
  {
    id: "case_7",
    title: "Chắp lẹo sưng đỏ mí mắt",
    patient: "Bạn trẻ thức khuya nổi cục chắp ở mi mắt trên đỏ tấy, cộm ngứa, đau nhức khó mở mắt.",
    diagnosis: "Lẹo mắt do nhiệt độc tích tụ kinh Phế và Vị.",
    target_points: ["h_25", "h_2", "h_3"], // Phế du, Ấn đường, Thái dương
    target_names: ["Phế du", "Ấn đường", "Thái dương"],
    explanation: "Mẹo lâm sàng độc đáo trong tài liệu: Chích nặn máu ở huyệt Phế Du (D3-D4 đo ra 1.5 thốn) làm tiêu sưng lẹo mắt cực nhanh; phối hợp Ấn Đường và Thái Dương."
  },
  {
    id: "case_8",
    title: "Tiêu chảy do bụng nhiễm lạnh",
    patient: "Ăn đồ sống lạnh rồi nằm quạt thốc vào bụng, nửa đêm đau quặn bụng dưới quanh rốn, đi ngoài phân lỏng toàn nước, tay chân lạnh ngắt.",
    diagnosis: "Tiêu chảy cấp thể hàn thấp (Hàn tả).",
    target_points: ["h_16", "h_17", "h_51"], // Thần khuyết, Thiên khu, Túc tam lý
    target_names: ["Thần khuyết", "Thiên khu", "Túc tam lý"],
    explanation: "LƯU Ý CỐT TỬ: Thần Khuyết ở rốn CẤM CHÂM, chỉ được CỨU CÁCH MUỐI để làm ấm tỳ vị chỉ tả; phối hợp Thiên Khu (ngang rốn 2 thốn) và Túc Tam Lý."
  },
  {
    id: "case_9",
    title: "Mất ngủ kinh niên, tim đập hồi hộp",
    patient: "Người làm việc căng thẳng, đêm nằm trằn trọc 2-3 tiếng không ngủ được, hay giật mình, tim đập nhanh hồi hộp, hay quên.",
    diagnosis: "Mất ngủ do Tâm Thận bất giao, thần bất định.",
    target_points: ["h_38", "h_36", "h_55", "h_26"], // Thần môn, Nội quan, Tam âm giao, Tâm du
    target_names: ["Thần môn", "Nội quan", "Tam âm giao"],
    explanation: "Bộ 3 an thần kinh điển: Thần Môn dưỡng tâm an thần; Nội Quan thư thái lồng ngực điều hòa nhịp tim; Tam Âm Giao tư âm giáng hỏa, đưa giấc ngủ sâu êm dịu."
  },
  {
    id: "case_10",
    title: "Chuột rút vọp bẻ bắp chuối dữ dội",
    patient: "Vận động viên đang bơi lội bị co rút cứng đờ khối cơ bắp chân sau, đau quặn thắt chân không co duỗi được.",
    diagnosis: "Co rút cơ bắp chân cấp tính (Chuột rút / Vọp bẻ).",
    target_points: ["h_53", "h_49", "h_52"], // Thừa sơn, Ủy trung, Dương lăng tuyền
    target_names: ["Thừa sơn", "Dương lăng tuyền", "Ủy trung"],
    explanation: "Thừa Sơn nằm ngay nơi hợp lại của 2 cơ sinh đôi bắp chân, bấm mạnh vào điểm này gân cơ lập tức nhả ra; Dương Lăng Tuyền là huyệt Hội của Cân (gân) giúp thư cân chỉ thống."
  }
];
