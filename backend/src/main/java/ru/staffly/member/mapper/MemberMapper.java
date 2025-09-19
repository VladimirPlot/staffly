package ru.staffly.member.mapper;

import org.springframework.stereotype.Component;
import ru.staffly.member.dto.MemberDto;
import ru.staffly.member.model.RestaurantMember;

@Component
public class MemberMapper {

    public MemberDto toDto(RestaurantMember m) {
        if (m == null) return null;
        return new MemberDto(
                m.getId(),
                m.getUser() != null ? m.getUser().getId() : null,
                m.getRestaurant() != null ? m.getRestaurant().getId() : null,
                m.getRole(),
                m.getPosition() != null ? m.getPosition().getId() : null,
                m.getPosition() != null ? m.getPosition().getName() : null,
                m.getAvatarUrl()
        );
    }
}