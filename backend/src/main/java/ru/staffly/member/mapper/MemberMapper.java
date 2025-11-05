package ru.staffly.member.mapper;

import org.springframework.stereotype.Component;
import ru.staffly.member.dto.MemberDto;
import ru.staffly.member.model.RestaurantMember;

@Component
public class MemberMapper {

    public MemberDto toDto(RestaurantMember m) {
        var user = m.getUser();
        var pos  = m.getPosition();

        String first = user != null ? safe(user.getFirstName()) : null;
        String last  = user != null ? safe(user.getLastName())  : null;

        // Берём fullName из юзера, если есть; иначе склеиваем "Фамилия Имя"
        String full  = (user != null && notBlank(user.getFullName()))
                ? user.getFullName().trim()
                : joinTwo(last, first);

        return new MemberDto(
                m.getId(),
                user != null ? user.getId() : null,
                m.getRestaurant() != null ? m.getRestaurant().getId() : null,
                m.getRole(),
                pos != null ? pos.getId() : null,
                pos != null ? pos.getName() : null,
                m.getAvatarUrl(),
                first,
                last,
                full,
                user != null ? user.getBirthDate() : null
        );
    }

    private static String safe(String s) { return s == null ? null : s.trim(); }
    private static boolean notBlank(String s) { return s != null && !s.trim().isEmpty(); }

    private static String joinTwo(String a, String b) {
        String aa = safe(a);
        String bb = safe(b);
        if (notBlank(aa) && notBlank(bb)) return (aa + " " + bb).trim();
        if (notBlank(aa)) return aa;
        if (notBlank(bb)) return bb;
        return null;
    }
}