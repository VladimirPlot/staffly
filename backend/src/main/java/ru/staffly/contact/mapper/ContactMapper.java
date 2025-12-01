package ru.staffly.contact.mapper;

import org.springframework.stereotype.Component;
import ru.staffly.contact.dto.ContactDto;
import ru.staffly.contact.model.Contact;

@Component
public class ContactMapper {

    public ContactDto toDto(Contact entity) {
        return new ContactDto(
                entity.getId(),
                entity.getRestaurant().getId(),
                entity.getName(),
                entity.getDescription(),
                entity.getPhone(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}