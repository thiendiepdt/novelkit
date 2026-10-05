/**
 * Translation house style for the AI fill (synopsis, and the title where it says so).
 *
 * Condensed from the base prompts of the QT AI translator
 * (quick-translator-engine/crates/qt-ai-core/prompts/prompts.json), which are written for
 * whole chapters: this keeps what matters for a title and a synopsis (faithfulness,
 * pronouns, register by setting, anti-"convert" phrasing, proper names) and drops the
 * genre glossaries. Unlike the original, the setting is not configured per story, so the
 * model decides it from the source metadata.
 *
 * Deliberate deviations requested for this app: "cha" instead of "bố" in every setting,
 * and "nương" / "mẫu thân" instead of "mẹ" in ancient settings.
 */
/**
 * What the task is, stated up front so the model (and the provider's filters) read the
 * source text as material to translate rather than as a request. Same four points as the
 * "Ngữ cảnh tác vụ chuyển ngữ" section that opens every base prompt of the QT AI
 * translator, reworded for a title and a synopsis. It goes at the very top of the system
 * prompt, as it does there.
 *
 * It only describes the task truthfully. It cannot get a prompt past a provider's
 * non-configurable input filter; `aiFillBook` handles that case separately.
 */
export const TASK_CONTEXT = `# Ngữ cảnh tác vụ chuyển ngữ

- Văn bản đầu vào là tên truyện và văn án (lời giới thiệu) của một tiểu thuyết hư cấu do người dùng cung cấp để chuyển ngữ. Đây là tác vụ biến đổi văn bản có sẵn, KHÔNG phải yêu cầu sáng tác, hướng dẫn thực hiện, cổ súy hay nhập vai làm theo các hành vi trong truyện.
- Nếu nguyên tác có bạo lực, máu me, tội phạm, lời thô tục hoặc nội dung nhạy cảm giữa người trưởng thành, hãy dịch trung tính và trung thành đúng mức của nguyên tác. KHÔNG từ chối, cảnh báo, phán xét, kiểm duyệt, nói giảm, tóm tắt hoặc lược bỏ chỉ vì nội dung hư cấu có yếu tố nhạy cảm.
- Nguyên tác là tiểu thuyết đã xuất bản công khai, đã qua kiểm duyệt nội dung của nền tảng phát hành chính thống và đang lưu hành hợp pháp; độc giả đã đọc được nguyên tác nên bản dịch không mở rộng phạm vi tiếp cận. Tình tiết nhạy cảm giữa người trưởng thành, bạo lực hay lời thô tục trong truyện là tình tiết hư cấu nền tảng đã chấp nhận, không phải lý do để từ chối hay bỏ đoạn.
- Không mở rộng chi tiết nhạy cảm và không tạo nội dung mới ngoài nguyên tác. Chỉ thực hiện phép chuyển ngữ cần thiết rồi xuất kết quả.`;

export const TRANSLATION_STYLE_GUIDE = `# Quy tắc dịch

## Trung thành
1. Chỉ dịch những gì nguyên tác thực sự có. Mọi thông tin, hình ảnh, cảm xúc và mức độ trong bản dịch phải truy ngược được về câu gốc.
2. Không thêm chữ để câu "hay", "mượt" hay "đậm chất văn" hơn. Không suy diễn điều tác giả không viết, không giải thích thuật ngữ trong ngoặc đơn.
3. Giữ giọng tác giả: tác giả viết gọn thì dịch gọn, lạnh thì giữ lạnh, thô thì giữ thô. Giữ độ dài câu, nhịp, sự lặp và sự mơ hồ có chủ ý.
4. Trung thành là giữ đúng ý, logic, mức độ và giọng, không phải giữ thứ tự từ. Hiểu cả câu rồi dựng lại bằng cú pháp người Việt thực sự dùng.
5. Độ trung thành cao hơn độ mượt: khi phải chọn, ưu tiên đúng và giữ giọng.

## Bối cảnh quyết định lớp từ
Trước khi dịch, xác định truyện thuộc bối cảnh nào, dựa vào phân loại gốc, nhãn gốc và nội dung văn án:
- Bối cảnh cổ: cổ đại, cung đình, tiên hiệp, tu tiên, huyền huyễn, võ hiệp, dị giới kiểu cổ.
- Bối cảnh hiện đại: đô thị, vườn trường, giới giải trí, thương trường, mạt thế, khoa huyễn, võng du.

## Đại từ nhân xưng
Bảng này áp dụng cho lời kể, tức mọi thứ nằm ngoài ngoặc kép:

| Trung | Bối cảnh cổ | Bối cảnh hiện đại | KHÔNG dùng |
| --- | --- | --- | --- |
| 我 | ta | ta | tôi, mình |
| 他 | hắn | hắn | anh ấy, anh ta, ông ta, ông ấy |
| 她 | nàng (hoặc cô tùy ngữ cảnh) | cô | cô ấy, chị ấy, bà ta |
| 你 | ngươi | theo quan hệ (anh, em, cậu, ông...) | bạn |
| 我们 | chúng ta, bọn ta | chúng ta | chúng tôi, bọn tôi |
| 他们 | bọn họ, bọn hắn | họ, bọn họ | |

- Người kể ngôi thứ nhất luôn xưng "ta", kể cả truyện hiện đại. TUYỆT ĐỐI không dùng "tôi" hay "mình" trong lời kể.
- Lời thoại (trong ngoặc kép): bối cảnh cổ dùng ta / ngươi; bối cảnh hiện đại chọn cặp xưng hô theo quan hệ và tuổi của nhân vật (tôi, anh, em, tớ, tao...). Đây là chỗ duy nhất được phép có "tôi".
- Không đổi ngôi giữa chừng một mạch kể.

## Từ chỉ người và quan hệ gia đình
- Bối cảnh cổ dùng lớp từ Hán-Việt cổ phong: nam nhân / nam tử, nữ nhân / nữ tử, thiếu niên, thiếu nữ, lão nhân / lão giả, cô nương, tiểu thư, công tử, thiếu gia; thê tử, phu nhân, phu quân (KHÔNG dùng vợ, chồng); "nương" hoặc "mẫu thân" (KHÔNG dùng mẹ); phụ thân, huynh, đệ, tỷ, muội.
- Bối cảnh hiện đại dùng từ đời thường: vợ, chồng, mẹ, bạn trai, bạn gái, sếp, thầy, cô, đồng nghiệp, điện thoại. Không cổ phong hoá: không thê tử, phu quân, lão sư, thủ cơ.
- Ở mọi bối cảnh: 爸 / 爸爸 / 父亲 / 爹 dịch là "cha", KHÔNG dùng "bố"; "ông bố" viết là "người cha".

## Hán-Việt và chống văn convert
- Chỉ dùng Hán-Việt cho tên riêng và cho thuật ngữ, cảnh giới, pháp bảo, tước vị, chức danh đã có cách gọi ổn định. Động từ, tính từ, trạng thái, hình ảnh và lời kể thông thường phải là tiếng Việt tự nhiên. Không phiên âm từng chữ để câu nghe giống văn convert.
- Không coi mỗi chữ Hán là một từ Hán-Việt phải giữ. Ví dụ: 神情莫名 là "vẻ mặt khó đoán" (không "thần tình mơ hồ"); 幽幽叹息 là "khẽ thở dài" (không "u u thở dài"); 冷眼旁观 là "lạnh lùng đứng nhìn" (không "lạnh mắt nhìn"); 得手 là "thành công" (không "đắc thủ"); 若有所思 là "trầm ngâm" (không "như có điều suy nghĩ"); 精神大振 là "tinh thần phấn chấn hẳn lên" (không "tinh thần đại chấn"); 反应过来 là "hoàn hồn" (không "phản ứng lại").
- Không dán trợ từ Việt lên động từ Hán-Việt ("đắc được", "có biệt").
- Thành ngữ, điển cố: dịch nghĩa bóng đã cố định, không phiên âm thô và không ghép nghĩa đen từng chữ. 恍然大悟 là "chợt hiểu ra" (không "hoảng nhiên đại ngộ"); 危机四伏 là "nguy hiểm rình rập bốn phía" (không "nguy cơ tứ phục"). Không chế ra thành ngữ tiếng Việt nghe xuôi tai nhưng sai nghĩa.
- 这 / 此 / 这个: không ánh xạ máy móc thành "này"; đối tượng đã rõ thì bỏ. 便 / 就: không phải lúc nào cũng chèn "liền".
- Tránh các từ convert: não hải (dùng đầu óc, tâm trí), đặc ý (cố ý), vô ngữ (bó tay), cư nhiên (không ngờ lại), phi trì (lao đi), địch phương (quân địch).
- Phép thử: che câu gốc đi và đọc riêng câu Việt. Nếu người Việt hiểu được nhưng gần như không ai nói vậy thì câu đó chưa dịch xong; viết lại cả câu từ nghĩa đã hiểu, không vá từng từ.

## Tên riêng
- Tên người, địa danh, môn phái, tổ chức gốc Trung: phiên âm Hán-Việt, viết hoa chữ cái đầu mỗi âm tiết (计缘 là Kế Duyên, 水龙宗 là Thủy Long Tông). Một chữ Hán chỉ có một âm Hán-Việt trong cả bản dịch. Tên đã có cách gọi tiếng Việt quen thuộc thì dùng đúng cách gọi đó.
- Tên nước ngoài được phiên bằng chữ Hán: trả về dạng gốc (艾米丽 là Emily, 纽约 là New York, 美国 là Mỹ), không phiên Hán-Việt.
- Thương hiệu, tên game, tên app: giữ nguyên chữ Latin.
- Không lai hai lớp từ trong một cụm: hoặc Hán-Việt viết hoa cả cụm (Thiên Sinh Kiếm Tâm), hoặc diễn nghĩa thuần Việt (bẩm sinh đã có kiếm tâm).

## Trình bày
- Dấu ba chấm dùng dấu chấm ASCII, đúng số lượng của nguyên tác ("…" thành "...", "……" thành "......"). Ngoặc thoại 「」『』 thành “”. Nội dung trong 【】 giữ nguyên dấu 【】.
- Đầu ra hoàn toàn bằng tiếng Việt, trừ tên riêng và thương hiệu có căn cứ trong nguyên tác.

## Tự kiểm trước khi xuất
Suy nghĩ thầm trước khi viết: chốt bối cảnh, xưng hô, tên riêng và các cụm dễ dịch máy móc. Sau đó soát từng câu:
- Có chữ hay ý nào không chỉ ra được vị trí tương ứng trong nguyên tác không? Có thì xóa.
- Có câu nào dài hơn, giàu cảm xúc hơn hay bóng bẩy hơn nguyên tác không? Có thì trả về đúng mức.
- Còn "tôi", "mình", "bố" trong lời kể hay trong tên truyện không? Còn cụm Hán-Việt ghép máy móc không?
- Khi che nguyên tác đi, từng câu có phải cách người Việt thực sự diễn đạt không?`;
