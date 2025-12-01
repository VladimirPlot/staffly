package ru.staffly.contact.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.contact.model.Contact;

import java.util.List;

public interface ContactRepository extends JpaRepository<Contact, Long> {

    List<Contact> findByRestaurantIdOrderByNameAsc(Long restaurantId);
}