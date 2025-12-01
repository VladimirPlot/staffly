package ru.staffly.contact.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.contact.dto.ContactDto;
import ru.staffly.contact.dto.ContactRequest;
import ru.staffly.contact.mapper.ContactMapper;
import ru.staffly.contact.model.Contact;
import ru.staffly.contact.repository.ContactRepository;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ContactServiceImpl implements ContactService {

    private final ContactRepository contacts;
    private final RestaurantRepository restaurants;
    private final ContactMapper mapper;
    private final SecurityService security;

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<ContactDto> list(Long restaurantId, Long currentUserId) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        return contacts.findByRestaurantIdOrderByNameAsc(restaurantId).stream()
                .map(mapper::toDto)
                .toList();
    }

    @Override
    @Transactional
    public ContactDto create(Long restaurantId, Long currentUserId, ContactRequest request) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        Restaurant restaurant = restaurants.findById(restaurantId)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));

        Contact entity = Contact.builder()
                .restaurant(restaurant)
                .name(normalize(request.name()))
                .description(normalizeDescription(request.description()))
                .phone(normalize(request.phone()))
                .build();

        validate(entity);

        entity = contacts.save(entity);
        return mapper.toDto(entity);
    }

    @Override
    @Transactional
    public ContactDto update(Long restaurantId, Long currentUserId, Long contactId, ContactRequest request) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        Contact entity = contacts.findById(contactId)
                .orElseThrow(() -> new NotFoundException("Contact not found: " + contactId));
        if (!entity.getRestaurant().getId().equals(restaurantId)) {
            throw new NotFoundException("Contact not found in this restaurant");
        }

        entity.setName(normalize(request.name()));
        entity.setDescription(normalizeDescription(request.description()));
        entity.setPhone(normalize(request.phone()));

        validate(entity);

        entity = contacts.save(entity);
        return mapper.toDto(entity);
    }

    @Override
    @Transactional
    public void delete(Long restaurantId, Long currentUserId, Long contactId) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        Contact entity = contacts.findById(contactId)
                .orElseThrow(() -> new NotFoundException("Contact not found: " + contactId));
        if (!entity.getRestaurant().getId().equals(restaurantId)) {
            throw new NotFoundException("Contact not found in this restaurant");
        }
        contacts.delete(entity);
    }

    private String normalize(String value) {
        return value == null ? null : value.trim();
    }

    private String normalizeDescription(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void validate(Contact entity) {
        if (entity.getName() == null || entity.getName().isBlank()) {
            throw new BadRequestException("Название контакта обязательно");
        }
        if (entity.getPhone() == null || entity.getPhone().isBlank()) {
            throw new BadRequestException("Телефон обязателен");
        }
        if (entity.getName().length() > 200) {
            throw new BadRequestException("Слишком длинное название");
        }
        if (entity.getPhone().length() > 100) {
            throw new BadRequestException("Слишком длинный номер телефона");
        }
        if (entity.getDescription() != null && entity.getDescription().length() > 2000) {
            throw new BadRequestException("Слишком длинное описание");
        }
    }
}