package ru.staffly.contact.service;

import ru.staffly.contact.dto.ContactDto;
import ru.staffly.contact.dto.ContactRequest;

import java.util.List;

public interface ContactService {

    List<ContactDto> list(Long restaurantId, Long currentUserId);

    ContactDto create(Long restaurantId, Long currentUserId, ContactRequest request);

    ContactDto update(Long restaurantId, Long currentUserId, Long contactId, ContactRequest request);

    void delete(Long restaurantId, Long currentUserId, Long contactId);
}